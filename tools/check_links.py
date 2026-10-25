"""Check every link in the guide.

    python tools/check_links.py            # everything, outside sites included
    python tools/check_links.py --offline  # only links inside the repo

Checks, in index.html and pdf-editor.html:
  - "#id" and "#/id" links point at an element that exists
  - links to files in the repo (pdfs, pdf-editor.html, ?file= targets) exist
  - outside links answer; a Google file that needs sign-in counts as working
    (it is private on purpose), a 404 or a dead server does not
  - the scheduler's script reports healthy (its ?check=1 page), and the master
    calendar is private and every calendar link uses the same sheet id
Exits 1 if anything is broken, so it can run before a push.
"""
import concurrent.futures
import html.parser
import os
import re
import sys
import urllib.error
import urllib.parse
import json
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", "pdf-editor.html"]
AGENT = "Mozilla/5.0 (link check for the KCM pamphlet guide)"


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links = set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        for key in ("href", "src"):
            v = a.get(key)
            # <use href="#i-print"> is an icon reference inside an SVG, not a link.
            if v and tag != "use" and not v.startswith(("data:", "javascript:", "mailto:")):
                self.links.append((tag, v))


def fetch(url, body=False):
    """-> (status, final url[, text]). Status 0 means no answer at all."""
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf8", "replace") if body else None
            return (r.status, r.geturl(), text) if body else (r.status, r.geturl())
    except urllib.error.HTTPError as e:
        return (e.code, url, "") if body else (e.code, url)
    except Exception as e:  # DNS, timeout, TLS: the site did not answer
        return (0, str(e), "") if body else (0, str(e))


def script_health(url):
    """The scheduler's own report: ok, or each problem with its fixes."""
    status, final, text = fetch(url + "?check=1", body=True)
    if status == 0:
        return "BROKEN", "no answer: " + final
    try:
        report = json.loads(text)
    except ValueError:
        if "KCM scheduler is running" in text:
            return "CHECK", "running, but an older version without ?check=1: redeploy Code.gs as a New version"
        return "BROKEN", "answered with something other than the scheduler (%d)" % status
    if report.get("ok"):
        return "OK", "healthy: sheet '%s', tabs and daily job present" % report.get("sheet")
    return "BROKEN", "; ".join(p["problem"] + " Fix: " + " / ".join(p["fix"]) for p in report["problems"])


def judge(url, status, final):
    host = urllib.parse.urlparse(url).netloc
    google_file = host in ("docs.google.com", "drive.google.com")
    if status == 0:
        return "BROKEN", "no answer: " + final
    if google_file and ("accounts.google.com" in final or status in (401, 403)):
        return "OK", "private, sign-in needed (expected for KCM files)"
    if status < 400:
        # A page that moved often redirects to a generic home page instead of
        # failing: same answer code, wrong page. Flag any change of path.
        before = urllib.parse.urlparse(url).path.rstrip("/")
        after = urllib.parse.urlparse(final).path.rstrip("/")
        if google_file or before == after:
            return "OK", str(status)
        return "CHECK", "redirected to " + final
    if status in (403, 429):
        return "CHECK", "%d: the site blocks automated checks; open it by hand" % status
    return "BROKEN", str(status)


def main():
    offline = "--offline" in sys.argv
    rows, outside = [], {}
    for page in PAGES:
        parser = Links()
        parser.feed(open(os.path.join(ROOT, page), encoding="utf8").read())
        for tag, link in parser.links:
            if link.startswith("#"):
                target = link.lstrip("#/")
                ok = target in parser.ids
                rows.append(("OK" if ok else "BROKEN", page, link, "anchor" if ok else "no element with this id"))
            elif link.startswith(("http://", "https://")):
                outside.setdefault(link, page)
            else:
                path = urllib.parse.urlparse(link)
                ok = os.path.exists(os.path.join(ROOT, urllib.parse.unquote(path.path)))
                for target in urllib.parse.parse_qs(path.query).get("file", []):
                    ok = ok and os.path.exists(os.path.join(ROOT, target))
                rows.append(("OK" if ok else "BROKEN", page, link, "file in repo" if ok else "missing file"))

    if not offline:
        # The two Google endpoints the page calls from its scripts, not from links.
        src = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()
        script = re.search(r'var SCRIPT_URL = "([^"]+)"', src)
        sheet = re.search(r'var CAL_SHEET_ID = "([^"]+)"', src)
        if script:
            outside.pop(script.group(1), None)
            verdict, why = script_health(script.group(1))
            rows.append((verdict, "scheduler", script.group(1), why))
        # Every link to a Google Sheet in the guide is the master calendar, so
        # each must use CAL_SHEET_ID: a new year's sheet means changing them all.
        ids = set(re.findall(r"docs\.google\.com/spreadsheets/d/([\w-]+)", src))
        if sheet and ids - {sheet.group(1)}:
            rows.append(("BROKEN", "master calendar", "sheet ids", "links use %s but CAL_SHEET_ID is %s: update them together" % (", ".join(sorted(ids - {sheet.group(1)})), sheet.group(1))))
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            for url, (status, final) in zip(outside, pool.map(fetch, outside)):
                verdict, why = judge(url, status, final)
                rows.append((verdict, outside[url], url, why))
        if sheet:
            status, final = fetch("https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv" % sheet.group(1))
            if status in (401, 403) or "accounts.google.com" in final:
                verdict, why = "OK", "private, as it should be"
            elif status == 404:
                verdict, why = "BROKEN", "no sheet with this id: wrong id in CAL_SHEET_ID, or the sheet was deleted"
            elif status == 200:
                verdict, why = "CHECK", "readable by anyone: it should be shared with KCM leaders only"
            else:
                verdict, why = "CHECK", "unexpected answer %d" % status
            rows.append((verdict, "master calendar", "sheet " + sheet.group(1), why))

    order = {"BROKEN": 0, "CHECK": 1, "OK": 2}
    rows.sort(key=lambda r: (order[r[0]], r[1], r[2]))
    for verdict, where, link, why in rows:
        if verdict != "OK" or "-v" in sys.argv:
            print("%-6s %-16s %s  (%s)" % (verdict, where, link, why))
    counts = {v: sum(1 for r in rows if r[0] == v) for v in order}
    print("%d links: %d ok, %d to check by hand, %d broken" % (len(rows), counts["OK"], counts["CHECK"], counts["BROKEN"]))
    sys.exit(1 if counts["BROKEN"] else 0)


if __name__ == "__main__":
    main()
