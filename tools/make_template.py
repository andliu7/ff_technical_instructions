"""Turn the Fall FF #02 export into a fill-in pamphlet template.

Everything that changes each Focus Family is cleared and replaced by a fill-in
text field holding sample text in the same place. What stays the same all
year (KCM, Who we are, Church, Let's stay connected and its QR codes) is kept.
"""
import sys
import pymupdf

src, out = sys.argv[1], sys.argv[2]
doc = pymupdf.open(src)
R = pymupdf.Rect


def clear(page, rect, images=False, marks=False):
    """Remove the text inside rect. images: the pictures too. marks: also
    underlines and highlights lying wholly inside it (lines that only cross
    it, like the column dividers, stay)."""
    page.add_redact_annot(rect, fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE if images else pymupdf.PDF_REDACT_IMAGE_NONE,
                          graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED if marks else pymupdf.PDF_REDACT_LINE_ART_NONE)


def field(page, name, rect, value, size=20, align=0, multiline=True):
    w = pymupdf.Widget()
    w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
    w.field_name = name
    w.field_label = name
    w.rect = rect
    w.field_value = value
    w.text_font = "Helv"
    w.text_fontsize = size
    w.text_color = (0.1, 0.1, 0.13)
    # No fill and no border: the boxes must not print. PDF editors highlight
    # fill-in fields on screen, so they are still easy to find.
    w.fill_color = None
    w.border_width = 0
    if multiline:
        w.field_flags |= pymupdf.PDF_TX_FIELD_IS_MULTILINE
    w = page.add_widget(w)
    if align == 1:
        page.parent.xref_set_key(w.xref, "Q", "1")  # centred
        w.update()


# Page 1: the cover.
p = doc[0]
num = p.search_for("#2")[0]
clear(p, num)
field(p, "FF number", R(num.x0 - 2, num.y0 + 4, num.x1 + 6, num.y1 - 4), "#3", size=40, align=1, multiline=False)
clear(p, R(300, 236, 480, 302))
field(p, "Semester", R(300, 245, 480, 295), "[Fall 2026]", size=26, align=1, multiline=False)
for i, (x0, x1) in enumerate([(124, 284), (300, 462), (482, 652)]):
    clear(p, R(x0, 322, x1, 520), marks=True)
    field(p, "Meeting %d" % (i + 1), R(x0, 330, x1, 500),
          ["Tuesday 10/20", "Wednesday 10/21", "Thursday 10/22"][i] + "\n7:00-9:00 PM\n\nBuilding Room\n(Code)", size=17, align=1)
pic = max(p.get_image_info(), key=lambda im: (im["bbox"][2] - im["bbox"][0]) * (im["bbox"][3] - im["bbox"][1]))
box = R(pic["bbox"])
clear(p, box, images=True)
field(p, "Cover image note", R(box.x0 + 20, box.y0 + box.height / 2 - 60, box.x1 - 20, box.y0 + box.height / 2 + 60),
      "Cover image goes here.\nIn the PDF editor: Edit a PDF > Image,\nthen delete this box.", size=16, align=1)
clear(p, R(100, 1066, 664, 1110))
field(p, "Passage line", R(110, 1066, 662, 1108), "Book 1:1-10 • Title of the Passage", size=22, align=1, multiline=False)

# Page 2: background and the passage.
p = doc[1]
clear(p, R(40, 40, 700, 1040), marks=True)
field(p, "Background and passage", R(50, 50, 692, 1030),
      "Background: Two or three sentences of context: who wrote this, to whom, and what is happening "
      "around the passage. Cite your sources in the leader chat, not here.\n\n"
      "Book 1:1-10 (ESV): Title of the Passage\n\n"
      "1 Paste the passage here, verse numbers included. Bold the words you want people to notice.", size=19)

# Page 3: the reflection questions (the blank top half stays for notes).
p = doc[2]
clear(p, R(40, 892, 700, 1130))
field(p, "Questions", R(50, 894, 690, 1128),
      "1. First question: what does the passage say?\n\n2. Second question: what does it mean?\n\n"
      "3. Third question: how does it apply to your week?", size=18)

# Page 4: the semester theme and upcoming events change; the rest stays.
p = doc[3]
head = p.search_for("THEME:")[0]
clear(p, R(head.x1 + 2, head.y0, 700, head.y1))
field(p, "Theme title", R(head.x1 + 6, head.y0 + 1, 700, head.y1 - 1), "Semester Theme Title", size=20, multiline=False)
clear(p, R(50, 216, 700, 360))
field(p, "Theme verse", R(54, 218, 690, 358), "The semester theme verse.\n\n~Book 1:1 (NIV)", size=17)
clear(p, R(54, 920, 700, 1084))
field(p, "Upcoming events", R(56, 922, 692, 1082),
      "Day, M/DD @ time: Event\nDay, M/DD @ time: Event\nDay, M/DD @ time: Event\nDay, M/DD @ time: Event", size=17)

doc.set_metadata({"title": "KCM Focus Family Pamphlet Template", "author": "Kharis Campus Ministry",
                  "subject": "Fill in the boxes, add the cover image, then print as a booklet.",
                  "creator": "", "producer": "", "keywords": ""})
doc.del_xml_metadata()
doc.save(out, garbage=4, deflate=True, clean=True)
print("saved", out)
