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
    example-pamphlet.pdf  a finished pamphlet, Spring FF #06, as a reference

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

Under the calendar sits "Find a time", a when2meet replacement with two modes:

- **Group:** pick dates or weekdays and a time range, share one link, and each person
  types their name and drags over the grid (green available, yellow maybe). Submitting
  turns everything unmarked red and asks for a review before saving. Results show as a
  heat grid (click a slot for who is free, maybe, busy, or hasn't answered), a ranked
  list of best times, and a per-person view. The organiser picks the final time.
- **One-on-one:** a short wizard, then one of three flows: offer times and they book
  one, they share times and you pick, or propose a time they accept or answer.

The expand icon (top right) turns it full screen. Links look like `?meet=<id>`; the
organiser's own link adds `&admin=<token>` and is the only way to edit from another
device. Data lives in the `andrew-dashboard` Supabase project, schema `sched`, reached
only through four `public.sched_*` functions (migration
`dashboard/supabase/migrations/20260928120000_sched.sql`). Until that migration is
applied, everything saves in the browser only and the footer says so.

## Credits

Background effect from Canvas UI HexFloat. Fonts under the SIL Open Font License.
