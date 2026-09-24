import sys
import os
sys.path.insert(0, 'backend')
import pymupdf
import re
from app.textbook_service import find_pdf_path

def parse_textbook_toc(pdf_path, source_name=""):
    if not pdf_path or not os.path.exists(pdf_path):
        return []

    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    
    # 1. Identify TOC page(s)
    toc_pages = []
    for pno in range(1, min(16, total_pages + 1)):
        text = doc[pno - 1].get_text("text")
        # TOC keywords (English and variations)
        if re.search(r'\b(?:INDEX|CONTENTS|Index|Contents|Anukramanika|Title of Lesson|Sr No\.)\b', text, re.I):
            toc_pages.append(pno)

    raw_chapters = []

    for tp in toc_pages:
        text = doc[tp - 1].get_text("text")
        # Clean lines
        raw_lines = text.splitlines()
        lines = [re.sub(r'[\t\r\xa0\u2009]+', ' ', l).strip() for l in raw_lines]
        lines = [l for l in lines if l]

        for i, line in enumerate(lines):
            # Case A: Standalone number line like "1." or "1" or "Chapter 1"
            m_num_only = re.match(r'^(?:(?:CHAPTER|Chapter)\s+)?(\d{1,2})[\.\:\)]*$', line)
            if m_num_only:
                cnum = int(m_num_only.group(1))
                if 1 <= cnum <= 40 and i + 1 < len(lines):
                    next_line = lines[i + 1]
                    # Title line might have dots and page numbers: "Rational and Irrational numbers......... 01 to 06"
                    clean_title = re.sub(r'[\.\s_–—\-]{2,}.*$', '', next_line).strip()
                    # Check if next_line itself had page numbers or if they are on line i+2
                    sp, ep = None, None
                    pm = re.search(r'(\d{1,3})\s+to\s+(\d{1,3})', next_line)
                    if pm:
                        sp, ep = int(pm.group(1)), int(pm.group(2))
                    else:
                        pm2 = re.search(r'[\.\s_–—\-]{2,}\s*(\d{1,3})\s*$', next_line)
                        if pm2:
                            sp = int(pm2.group(1))
                        elif i + 2 < len(lines):
                            pm3 = re.search(r'(\d{1,3})\s+to\s+(\d{1,3})', lines[i + 2])
                            if pm3:
                                sp, ep = int(pm3.group(1)), int(pm3.group(2))
                            else:
                                pm4 = re.search(r'^\s*(\d{1,3})\s*$', lines[i + 2])
                                if pm4 and int(pm4.group(1)) > 0:
                                    sp = int(pm4.group(1))

                    if len(clean_title) >= 3 and not any(bad in clean_title.lower() for bad in ['chapters', 'pages', 'standard', 'index', 'contents', 'practicals', 'specimen', 'answers']):
                        raw_chapters.append({
                            "num": cnum,
                            "title": f"Chapter {cnum}: {clean_title}",
                            "book_sp": sp,
                            "book_ep": ep,
                            "toc_page": tp,
                        })
                continue

            # Case B: Number and title on same line: "1. Gravitation........... 1" or "2. Quadratic Equations ... 30 to 54"
            m_inline = re.match(r'^(?:(?:CHAPTER|Chapter)\s+)?(\d{1,2})\s*[\.\:\)]\s+([A-Za-z][^\.\d]{2,60}?)(?:[\.\s_–—\-]{2,}\s*(\d{1,3})(?:\s+to\s+(\d{1,3}))?|$)', line)
            if m_inline:
                cnum = int(m_inline.group(1))
                ctitle = m_inline.group(2).strip()
                sp = int(m_inline.group(3)) if m_inline.group(3) else None
                ep = int(m_inline.group(4)) if m_inline.group(4) else None

                if sp is None:
                    for look in lines[i+1:i+3]:
                        pm = re.search(r'(\d{1,3})\s+to\s+(\d{1,3})', look)
                        if pm:
                            sp, ep = int(pm.group(1)), int(pm.group(2))
                            break
                        pm2 = re.search(r'^\s*(\d{1,3})\s*$', look)
                        if pm2 and int(pm2.group(1)) > 0:
                            sp = int(pm2.group(1))
                            break

                if len(ctitle) >= 3 and not any(bad in ctitle.lower() for bad in ['chapters', 'pages', 'standard', 'index', 'contents', 'practicals', 'specimen', 'answers', 'fundamental']):
                    raw_chapters.append({
                        "num": cnum,
                        "title": f"Chapter {cnum}: {ctitle}",
                        "book_sp": sp,
                        "book_ep": ep,
                        "toc_page": tp,
                    })
                continue

    # Deduplicate keeping earliest valid occurrence
    seen_nums = set()
    unique_chapters = []
    for c in raw_chapters:
        if c["num"] not in seen_nums:
            seen_nums.add(c["num"])
            unique_chapters.append(c)

    unique_chapters.sort(key=lambda x: x["num"])

    if unique_chapters:
        # Determine offset: find the first chapter's actual starting page in the document
        first_ch = unique_chapters[0]
        first_title_core = re.sub(r'^Chapter \d+:\s*', '', first_ch["title"]).strip().lower()
        
        pdf_offset = None
        # Scan pages after TOC
        search_start = (first_ch.get("toc_page") or 1) + 1
        for pno in range(search_start, min(total_pages + 1, search_start + 25)):
            text = doc[pno - 1].get_text("text").lower()
            if first_title_core[:15] in text or (f"1." in text and first_title_core[:8] in text) or ("chapter 1" in text):
                if first_ch.get("book_sp") is not None:
                    pdf_offset = (pno - first_ch["book_sp"])
                else:
                    pdf_offset = pno - 1
                break

        if pdf_offset is None:
            last_toc = max(toc_pages) if toc_pages else 1
            pdf_offset = max(0, last_toc)

        # For books where book_sp is None (e.g. ICSE Physics), find each chapter by scanning body headings
        if any(c.get("book_sp") is None for c in unique_chapters):
            for ch in unique_chapters:
                cnum = ch["num"]
                core_title = re.sub(r'^Chapter \d+:\s*', '', ch["title"]).strip().lower()
                for pno in range(1, total_pages + 1):
                    if pno in toc_pages:
                        continue
                    ptext = doc[pno - 1].get_text("text").lower()
                    if f"chapter {cnum}" in ptext or (core_title[:15] in ptext and f"{cnum}" in ptext):
                        ch["pdf_sp"] = pno
                        break

        final_list = []
        for i, ch in enumerate(unique_chapters):
            if ch.get("pdf_sp") is not None:
                pdf_sp = ch["pdf_sp"]
            elif ch.get("book_sp") is not None:
                pdf_sp = ch["book_sp"] + pdf_offset
            else:
                pdf_sp = (i + 1) * 2 + pdf_offset

            pdf_sp = max(1, min(pdf_sp, total_pages))

            if ch.get("book_ep") is not None:
                pdf_ep = ch["book_ep"] + pdf_offset
            elif i + 1 < len(unique_chapters):
                next_ch = unique_chapters[i + 1]
                if next_ch.get("pdf_sp") is not None:
                    pdf_ep = next_ch["pdf_sp"] - 1
                elif next_ch.get("book_sp") is not None:
                    pdf_ep = next_ch["book_sp"] + pdf_offset - 1
                else:
                    pdf_ep = pdf_sp + 1
            else:
                pdf_ep = total_pages

            pdf_ep = max(pdf_sp, min(pdf_ep, total_pages))

            final_list.append({
                "source": source_name or os.path.basename(pdf_path),
                "chapter": ch["title"],
                "start_page": pdf_sp,
                "end_page": pdf_ep,
                "total_doc_pages": total_pages,
                "chunks_count": max(1, pdf_ep - pdf_sp + 1),
            })

        doc.close()
        return final_list

    doc.close()
    return []

if __name__ == "__main__":
    for f in [
        '803020004.pdf',  # Std 8 Maths
        '803020012.pdf',  # Std 8 Science
        '1003000608.pdf', # Std 10 Maths Algebra (Part 1)
        '1003000609.pdf', # Std 10 Maths Geometry (Part 2)
        '1003000265.pdf', # Std 10 Science Part 1
        '1003000270.pdf', # Std 10 Science Part 2
        'ICSE_Class10_Physics_Textbook.pdf',
        'ICSE_Class10_Chemistry_Textbook.pdf',
        'ICSE_Class10_Biology_Textbook.pdf',
        'ICSE_Class10_Mathematics_Textbook.pdf',
    ]:
        path = find_pdf_path(f)
        chs = parse_textbook_toc(path, f)
        print(f"\n=== {f} (Extracted {len(chs)} chapters) ===")
        for c in chs[:4]:
            print(f"  {c['chapter']} -> PDF Pages {c['start_page']} to {c['end_page']}")
        if len(chs) > 4:
            print(f"  ... and {len(chs)-4} more chapters (ends at page {chs[-1]['end_page']})")
