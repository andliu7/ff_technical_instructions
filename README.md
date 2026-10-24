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

Open `index.html` in a browser, or download `guide.pdf`.

## Run locally

    python3 -m http.server 8000

Then visit `http://localhost:8000`. A server is needed because the browser blocks the embedded PDF view on `file://`.

## Files

    index.html            the guide
    guide.pdf             printable version
    example-pamphlet.pdf  a finished pamphlet, Spring FF #06, imposed for printing (after Step 10)
    example-pamphlet-pages.pdf  the same pamphlet's four pages in reading order (before Step 10)
    pamphlet-template.pdf the pamphlet as a fill-in PDF (Fall FF #02 with the weekly parts as form fields)
    tools/make_template.py rebuilds it: python tools/make_template.py <Doc exported as PDF> pamphlet-template.pdf
    pdf-editor.html       the PDF editor's page, with its loading curtain
    apps-script/          the scheduler's shared store (Code.gs) and its test
    pdfcraft/             PdfCraft 0.13.0's web build, the PDF editor (see below)

The styles, the background effect, the copy buttons, the fonts (Libre Baskerville,
Instrument Sans, JetBrains Mono, Allura) and the annotated screenshots are all
inlined into `index.html`, so it is one self-contained file with no dependencies.

## The calendar

The first page carries the 26-27 KCM Master Calendar (Fall 2026 and Spring 2027
tabs) as a month, week and list view with the sheet's own colour code behind the
key icon. The events are a snapshot taken 2026-09-27, baked into `index.html`.
On load the page tries to read the sheet again so room numbers and times follow
the sheet; that works once the sheet is shared with anyone who has the link
(Share, General access, Anyone with the link, Viewer). Until then the snapshot
shows and the Refresh button says why. To move the snapshot forward, re-export
the sheet and rebuild the JSON in the `kcal-data` block.

## The scheduler

Under the calendar sits "Find a time", a when2meet replacement. It starts by asking who the
meeting is with (one person or a group) and how to find the time:

- **They share when they're free, I pick:** each person types their name and drags over
  the grid (green available, yellow maybe). Results show as a heat grid, a ranked list
  of best times and a per-person view. The organiser picks the final time.
- **I have a time in mind:** for one person, they accept it or suggest another; for a
  group, a poll of just that time, so everyone marks whether they can come.
- **I offer times, they book one:** one person only. They book one of your free slots.

Invitees can be pasted as `Marc, Ana and Sam.`. The organiser can delete a poll from its
menu or from "Your polls" (the clock icon), where polls this browser made are highlighted.
An optional email gets a short digest each morning someone new answered. Each poll
deletes itself 5 days after its confirmed time, else after its last day (weekday-only
polls: 30 days after their last change).

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

On the example pamphlet page: paste a link and a QR code draws as you type, to copy into the Doc
or save as a PNG. It uses qrcode-generator 2.0.4 (Kazuhiko Arase, MIT), inlined in `index.html`
so the guide stays one file.

## The PDF editor

`pdfcraft/` is the unmodified web release of [PdfCraft](https://github.com/storytold/pdfcraft)
0.13.0 (`pdfcraft-web-0.13.0.zip`, SHA-256 checked against the release's `SHA256SUMS.txt`),
under MIT or Apache-2.0; its `NOTICE` and licences sit beside it. It is a Rust app compiled
to WebAssembly: open, edit (text, images, highlights, drawing), organise pages, and print as a
booklet, all in the browser. `pdf-editor.html` is its page: a curtain counts 10 to 100% from
the real download while the app compiles, then lifts. The cover links to that page, Step 10
loads it in place on request, and the guide preloads the app once idle (not on scheduler
links or with data saver on) so the editor opens from the cache. To update it, replace the
folder with a newer release's files and change the two file names in `pdf-editor.html` and
in the preload in `index.html`.

## Credits

Background effect from Canvas UI HexFloat. Fonts under the SIL Open Font License.
