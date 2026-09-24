# Curriculum data (board PDFs)

Put official board PDFs here, organised by board / grade / subject, e.g.:

```
backend/data/maharashtra/class10/science/science_ch01.pdf
backend/data/maharashtra/class10/science/science_ch02.pdf
backend/data/maharashtra/class09/maths/...
```

This folder is **git-ignored** — do NOT commit copyrighted textbooks.

## Ingest a PDF into the RAG index

From the `backend/` folder (venv Python, no activation needed):

```powershell
.venv\Scripts\python.exe scripts\ingest_board.py data\maharashtra\class10\science\science_ch01.pdf --grade 10 --subject Science --chapter 1
```

Re-running is additive. To re-index a subject from scratch, clear it first (the
`VectorIndex.clear(board=..., subject=...)` helper).

## ⚠️ Rights reminder (public product)

Maharashtra Balbharati books are © the State Bureau. We ground on **short snippets
and always cite the source** (the index stores citation metadata). Show a
disclaimer in the app, and ideally request educational-use permission from
Balbharati. Only ingest material you're allowed to use.
