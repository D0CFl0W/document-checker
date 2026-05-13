from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pdfplumber
from docx import Document
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

BASE_DIR = Path(__file__).resolve().parent.parent
FONT_PATH = BASE_DIR / "fonts" / "DejaVuSans.ttf"


def _detect_format(document_path: Path) -> str:
    """Определяет pdf/docx по сигнатуре: в ZIP из фронта PDF могли назвать .docx."""
    try:
        head = document_path.read_bytes()[:8]
    except OSError as exc:
        raise ValueError(f"Не удалось прочитать файл {document_path}: {exc}") from exc

    if head.startswith(b"%PDF"):
        return ".pdf"
    if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
        return ".docx"

    suffix = document_path.suffix.lower()
    if suffix == ".pdf":
        return ".pdf"
    if suffix == ".docx":
        return ".docx"
    raise ValueError(
        f"Неподдерживаемый формат (ожидались PDF или DOCX): "
        f"{document_path.suffix or '(без расширения)'}",
    )


def extract_pdf(document_path: Path) -> str:
    try:
        text_parts: list[str] = []
        resolved = str(document_path.resolve())
        with pdfplumber.open(resolved) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts)
    except Exception as exc:
        raise ValueError(f"Ошибка чтения PDF {document_path}: {exc}") from exc


def extract_docx(document_path: Path) -> str:
    try:
        doc = Document(document_path)
    except Exception as exc:
        raise ValueError(f"Ошибка чтения файла {document_path}: {exc}") from exc
    return "\n".join(p.text for p in doc.paragraphs if p.text)


def extract_text(path: str | Path) -> str:
    document_path = Path(path)
    kind = _detect_format(document_path)
    if kind == ".docx":
        return extract_docx(document_path)
    return extract_pdf(document_path)


def normalize_text(text: str) -> str:
    without_nbsp = text.replace("\xa0", " ")
    collapsed_spaces = re.sub(r"[ \t]+", " ", without_nbsp)
    collapsed_newlines = re.sub(r"\n+", "\n", collapsed_spaces)
    return collapsed_newlines.strip()


patterns: dict[str, list[str]] = {
    "ФИО": [
        r"Студенту:\s*(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
        r"ФИО обучающегося:\s*(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
        r"обучающегося\s+(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
    ],
    "Группа": [
        r"Группа:\s*(?P<value>[A-ЯA-Z0-9\-]+)",
        r"Группы\s*(?P<value>[A-ЯA-Z0-9\-]+)",
    ],
    "Тема": [
        r"Тема ВКР:\s*«(?P<value>.+?)»",
        r'Тема\s*"(?P<value>.+?)"',
        r"на тему:\s*«(?P<value>.+?)»",
        r"Тема работы:\s*«(?P<value>.+?)»",
        r"по теме\s*(?P<value>.+?)(?:\(|$)",
    ],
    "Дата": [
        r"Дата:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)",
        r"Срок сдачи студентом.*?:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)",
    ],
    "Подпись": [
        r"Студент:\s*(?P<value>_+)",
    ],
}


def clean_value(value: str) -> str | None:
    stripped = value.strip()
    if re.fullmatch(r"_+", stripped):
        return None
    if re.fullmatch(r"\[.*?\]", stripped):
        return None
    without_trailing_paren = re.sub(r"\s*\(.*?\)\s*$", "", stripped)
    return without_trailing_paren.lstrip(":").strip()


def extract_field(text: str, field_patterns: list[str]) -> str | None:
    for pattern in field_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return clean_value(match.group("value"))
    return None


def extract_topic(raw_text: str) -> str | None:
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    for i, line in enumerate(lines):
        if not re.search(r"по теме", line, re.IGNORECASE):
            continue
        for j in range(i + 1, len(lines)):
            candidate = lines[j].strip()
            if not candidate or candidate.startswith("("):
                continue
            cleaned = re.sub(r"\s*\(.*?\)\s*$", "", candidate)
            return cleaned.lstrip(":").strip()
    return None


def parse_document(path: str | Path) -> dict[str, str | None]:
    document_path = Path(path)
    raw_text = extract_text(document_path)
    normalized = normalize_text(raw_text)

    result: dict[str, str | None] = {}
    for field, field_patterns in patterns.items():
        if field == "Тема":
            topic = extract_field(normalized, field_patterns) or extract_topic(raw_text)
            result[field] = topic
        else:
            result[field] = extract_field(normalized, field_patterns)
    return result


def parse_directory(directory: str | Path, limit: int = 5) -> list[dict[str, Any]]:
    root = Path(directory)
    if not root.exists():
        raise ValueError(f"Директория не существует: {root}")

    docx_files = list(root.glob("*.docx"))
    pdf_files = list(root.glob("*.pdf"))
    files_sorted = sorted(docx_files + pdf_files)
    if limit:
        files_sorted = files_sorted[:limit]

    results: list[dict[str, Any]] = []
    for file_path in files_sorted:
        try:
            data = parse_document(file_path)
            results.append({"file": file_path.name, "data": data})
        except Exception as exc:
            results.append({"file": file_path.name, "error": str(exc)})
    return results


def generate_pdf_report(results: list[dict[str, Any]], output_path: str) -> None:
    pdf_canvas = canvas.Canvas(output_path)
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_PATH)))
    pdf_canvas.setFont("DejaVu", 9)

    y_position = 800
    for item in results:
        if y_position < 100:
            pdf_canvas.showPage()
            pdf_canvas.setFont("DejaVu", 9)
            y_position = 800

        if "error" in item:
            pdf_canvas.drawString(
                50,
                y_position,
                f"{item['file']} — ОШИБКА: {item['error']}",
            )
            y_position -= 10
            continue

        data = item["data"]
        pdf_canvas.drawString(10, y_position, f"Файл: {item['file']}")
        y_position -= 10

        for key, value in data.items():
            display = value if value else "—"
            pdf_canvas.drawString(20, y_position, f"{key}: {display}")
            y_position -= 10
        y_position -= 9

    pdf_canvas.save()
