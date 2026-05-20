from io import BytesIO

from pypdf import PdfReader


def extract_pdf_text(pdf_bytes: bytes, *, max_pages: int = 10) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    parts: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        if index > max_pages:
            break
        text = page.extract_text() or ""
        if text.strip():
            parts.append(f"Page {index}\n{text.strip()}")
    return "\n\n".join(parts)
