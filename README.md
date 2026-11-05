# KCM Focus Family Prestudy Pamphlet Guide

## Memorandum

**TO** Incoming Focus Family Leaders
**FROM** Andrew Liu, Focus Family Leader
**DATE** August 2026
**SUBJECT** How to produce the bi-weekly Prestudy Pamphlet

Welcome to one of the quieter jobs in Focus Family leadership. On behalf of the Focus Family team, thank you for taking this role on.

The Prestudy Pamphlet is the four-page folded booklet you hand out at each Focus Family. The cover carries your group's meeting details, the inside spread holds the historical background and the reflection questions, and the back has general ministry information and space for notes. Producing it is part of your role from this semester on.

This guide is that process written down, start to finish. Until now it has been passed along informally from whoever produced the last one, so this is an attempt to put it somewhere everyone can find it.

A few practical things. Everything here is the current process, not the ideal one, so if you find a better way, say so and I or someone will update the guide. None of it requires you to be technical. If some part is not your strength, split it with your co-leader and take the other half. And please ask when you get stuck, at any point and about anything. I would much rather answer a question on Sunday than help you troubleshoot a jammed printer on Monday morning, and no one here will think less of you for asking.

I hope that you enjoy it more than you expect to 😊

Best regards,
Good luck,

Andrew Liu
Kharis Campus Ministry

## Read it

Open `index.html` in a browser. It reads one page at a time: the tabs at the top go to the
Memo, the Editor and the Calendar, and the contents sit in a sidebar on the left on wide
screens (the menu button opens them on smaller ones). `guide.pdf` is the printable version,
last made on 2026-09-09, so it lags the web guide: regenerate it after content changes.

Step 1 opens with the **simplified pamphlet** for new leaders: a plain layout with nothing
locked. Its "Save as a Google Doc" button is the Doc's `/copy` link, which gives the reader
their own copy in Drive. That only works while the Doc stays shared as "Anyone with the
link"; the link check cannot tell if it stops being shared, so check by opening the link
signed out.

## Run locally

    python3 -m http.server 8000

Then visit `http://localhost:8000`. A server is needed because the browser blocks the embedded PDF view on `file://`.

## Files

    index.html            the guide
    guide.pdf             printable version
    example-pamphlet.pdf  a finished pamphlet, Spring FF #06, imposed for printing (after Step 10)
    example-pamphlet-pages.pdf  the same pamphlet's four pages in reading order (before Step 10)
    pamphlet-template.pdf the pamphlet as a fill-in PDF (Fall FF #02 with the weekly parts as form fields)
    simplified-pamphlet.pdf  a plain-layout pamphlet for new leaders (Fall 2022, John 2:1-11); its Google Doc is linked from Step 1 with a /copy link
    tools/make_template.py rebuilds it: python tools/make_template.py <Doc exported as PDF> pamphlet-template.pdf
    tools/check_links.py  tests every link, the scheduler's health and the calendar's privacy: python tools/check_links.py
    pdf-editor.html       the PDF editor's page, with its loading curtain
    apps-script/          the scheduler's shared store (Code.gs) and its test
    pdfcraft/             PdfCraft 0.13.0's web build, the PDF editor (see below)

The styles, the background effect, the copy cards, the fonts (Libre Baskerville,
Instrument Sans, JetBrains Mono, Allura) and the screenshots are all inlined into
`index.html`, so the guide itself is one self-contained file. Two parts reach outside it:
the scheduler talks to a Google Apps Script, and the PDF editor lives in `pdfcraft/` beside
it. The guide fetches the editor in the background a few seconds after each visit (not on
scheduler links or with data saver on): the `.wasm` file is 42.5 MB (less over the wire if
the host compresses it).

## The calendar

The Calendar tab carries the 26-27 KCM Master Calendar (Fall 2026 and Spring 2027
tabs) as a month, week and list view with the sheet's own colour code behind the
key icon. The events are a snapshot taken 2026-09-27, baked into `index.html`.
On load the page tries to read the sheet again, but the sheet is shared only with
KCM leaders on purpose, so the live read fails and the snapshot shows; the Refresh
button says why. Never set the sheet to "Anyone with the link". To move the snapshot forward, re-export
the sheet and rebuild the JSON in the `kcal-data` block.

## The scheduler

At the top of the Calendar page, the "Find a time that works for everyone" card opens "Find a time", a
when2meet replacement, as a popup over the page (close it with the cross, a click outside
it or Escape). Making a poll takes two pages, with a setup tracker beside them (Set a name,
Who's coming?, When is it?, Send the link!, Wait for responses, Pick a time!). The bar is
weighted so the first three steps fill 90% of it:

1. **Give it a name** (optional; left blank it becomes "Meeting with Sam and Ana"), **your
   name** (required, red asterisk) and **who's it with** (optional): names or emails typed
   like email recipients, Enter or a comma after each, × to take one out. Pasting
   `Marc, Ana and Sam.` works too. Once your name is filled in, Enter on an empty box goes
   to page 2. An email in the list is only a name: nobody is emailed. When a guest opens
   the link, the list comes first: "Which one is you?" with a big button per name, and
   typing a name is the fallback below it. If they type a different name instead, their
   entry still counts as not answered.
2. **How long it is** (30 min to 2 hours) and **the dates** (required). People mark their
   free times between 9 AM and 11 PM in 30 minute slots.

The time zone is the chip beside the title: it starts as the device's zone, and a click
opens a list to change it. The zone is saved with the poll (`config.tz`). After creating,
only the organiser can still change it (on the share screen and on the poll itself, while
it is open), and the change saves to the poll for everyone; guests see it as a plain
label. Anyone who opens it from another zone sees the gap ("3 hours ahead of you") in amber. Times are labelled,
not converted. "Add to Google Calendar" passes the zone; the `.ics` download does not yet,
so it lands at the wrong hour for someone in another zone.

After creating, the share screen gives the link, a "Copy invite message" that includes the
length and, once added, the location, and an optional "Add details" box for location and a
note. Guests type their name and drag over the grid (green available, yellow maybe);
results show as a heat grid, a ranked list of best times and a per-person view, and the
organiser picks the final time. Polls made before this form (one-on-ones, a time in mind,
offered slots) still open from their links.

The organiser can delete a poll from its menu or from "Your polls" (the clock icon), where
polls this browser made are highlighted. Polls made with the new form send no email
digest: the form has no organiser email box, and the script only takes an email when a
poll is created. Each poll deletes itself 5 days after its confirmed time, else after its
last day (weekday-only polls: 30 days after their last change).

Delete, the digest and the automatic clean-up need the current `Code.gs` deployed: as of
2026-11-03 the live script is an older version (the link check says "older version"), so
they fail until it is redeployed as a New version (see "When something breaks"). Saving
a poll's details does not need the redeploy.

The expand icon (top right) turns it full screen. Links look like `?meet=<id>`; the
organiser's own link adds `&admin=<token>` and is the only way to edit from another
device. Data lives in a Google Sheet in the KCM account, behind the Apps Script web
app in `apps-script/Code.gs` (one row per poll, one per answer; tokens stored only as
hashes). The page reaches it through `SCRIPT_URL` near the top of the scheduler script.
While `SCRIPT_URL` is empty, everything saves in the browser only and the footer says
so. Test the script without Google: `node apps-script/test.mjs`. After changing
`Code.gs`, paste it into the Apps Script editor and use Deploy > Manage deployments >
edit > New version: saving alone does not update the live URL. A `?meet=` link shows
the scheduler alone, with the guide hidden.

## The QR maker

On the Editor page, right under the editor: paste a link and a QR code draws as you type, to
copy into the Doc or save as a PNG. The cover's QR tile links there. It uses qrcode-generator 2.0.4 (Kazuhiko Arase, MIT), inlined in `index.html`
so the guide stays one file.

## The PDF editor

`pdfcraft/` is the unmodified web release of [PdfCraft](https://github.com/storytold/pdfcraft)
0.13.0 (`pdfcraft-web-0.13.0.zip`, SHA-256 checked against the release's `SHA256SUMS.txt`),
under MIT or Apache-2.0; its `NOTICE` and licences sit beside it. It is a Rust app compiled
to WebAssembly: open, edit (text, images, highlights, drawing), organise pages, and print as a
booklet, all in the browser. `pdf-editor.html` is its page: a curtain counts 10 to 100% from
the real download while the app compiles, then lifts.

The Editor tab opens it in a window on the page the first time that page is shown, with the
QR maker under it and four short steps with screenshots of the running editor (step 3's
picture shows the All tools list, not the rotate screen). Above the window, four ready-made
PDFs (blank template, example pamphlet, print-ready booklet, simplified pamphlet) fly into
it on click and reopen the editor on that file through `pdf-editor.html?file=<name>`. That
`?file=` loading is PdfCraft's own behaviour, not code in this repo, so check it by hand
after any PdfCraft update. Step 10 loads the editor in place on request, and the guide
preloads the app once idle (not on scheduler links or with data saver on) so the editor
opens from the cache. To update it, replace the folder with a newer release's files and
change the two file names in `pdf-editor.html` and in the preload in `index.html`.

## When something breaks

Run `python tools/check_links.py` first: it says which part is broken. For the scheduler,
open the script's address (`SCRIPT_URL` in `index.html`) with `?check=1` on the end; it lists
each problem with the ways to fix it.

Google finds files by id, not by folder, so **moving or renaming** the sheets in Drive, or
passing a folder to the next leader, changes nothing. What does break things:

| What happened | What you see | Options |
|---|---|---|
| The scheduler's sheet was deleted | Guests see "can't reach its storage sheet"; `?check=1` says it cannot open the sheet | Restore it from the Drive trash of the account that owned it; or make a new sheet, put its id in `SHEET_ID` in `Code.gs`, run `setup`, deploy a New version |
| The sheet now belongs to someone else and the script's account lost access | Same as above | Ask the new owner to share it with the script's account as Editor; or the new owner copies `Code.gs` into their own Apps Script, deploys it, and `SCRIPT_URL` in `index.html` changes to their address |
| A tab was removed from the sheet | Guests see "storage sheet isn't set up" | Run `setup` in the Apps Script editor; it recreates the tabs |
| `Code.gs` changed but was not redeployed | The link check says "older version"; new features answer `unknown_function` | Deploy > Manage deployments > edit > New version |
| Next year's master calendar is a new sheet | The link check says the calendar ids disagree, or "no sheet with this id" | Change `CAL_SHEET_ID` and every calendar link in `index.html` together (the check finds any you miss), then refresh the snapshot |
| The master calendar became readable by anyone | The link check says "readable by anyone" | Share, General access, Restricted. It should be shared with KCM leaders only |

The scheduler's script and sheet live on Andrew's Google account for now. At handoff,
either keep them there and share the sheet with the next leader, or move them with the
second row of the table.

## Credits

Background effect from Canvas UI HexFloat. Fonts under the SIL Open Font License.
