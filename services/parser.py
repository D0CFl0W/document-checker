from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import fitz
import pytesseract
from PIL import Image
from pathlib import Path
import pdfplumber
from docx import Document
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from collections import defaultdict

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


def extract_pdf_ocr(document_path: Path, lang: str = "rus+eng", zoom: float = 2.0) -> str:
    try:
        doc = fitz.open(str(document_path.resolve()))
        text_parts: list[str] = []

        mat = fitz.Matrix(zoom, zoom)
        config = r"--oem 3 --psm 6"

        for page in doc:
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

            img = img.convert("L")  # <<< ВАЖНО

            page_text = pytesseract.image_to_string(
                img,
                lang=lang,
                config=config
            )

            text_parts.append(page_text)

        return "\n".join(text_parts)

    except Exception as exc:
        raise ValueError(f"Ошибка OCR PDF {document_path}: {exc}") from exc


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

    return extract_pdf_ocr(document_path)


def normalize_text(text: str) -> str:
    text = text.replace("\xa0", " ")

    text = re.sub(r"[|•·]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"\s{2,}", " ", text)

    return text.strip()



def fix_ocr_errors(text: str) -> str:
    replacements = {
        "Гpyппа": "Группа",
        "Групnа": "Группа",
        "TeMa": "Тема",
        "Teмa": "Тема",
        "CTyдeнт": "Студент",
        "Cтудент": "Студент",
        "ФИ0": "ФИО",
        "oбучающегося": "обучающегося",
        "»": "",
    }

    for wrong, correct in replacements.items():
        text = text.replace(wrong, correct)

    return text


patterns: dict[str, list[str]] = {
    "ФИО": [
    r"(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)\s+[А-ЯЁ][а-яё]+)",

    r"(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)\s+[А-ЯЁ][а-яё]+)"
    ],
    "Группа": [
        r"(?:Группа|Группы)\s*[:\-]?\s*(?P<value>[A-ЯA-ZЁ]{1,4}\s*-?\s*\d{2,6})",
        r"(?:группа)\s*(?P<value>[A-ЯA-ZЁ]{1,4}\s*-?\s*\d{2,6})",
        r"(?P<value>[A-ЯA-ZЁ]{1,4}-\d{2,6})"
    ],
    "Тема": [
    r"(?:Тема|Tema|Teмa|Тeмa|Тема работы|Тема ВКР|на тему|по теме)\s*[:\-]?\s*«?(?P<value>[^\n»]{10,250})»?"
    ],
    "Дата": [
        r"Дата:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)",
        r"Срок сдачи студентом.*?:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)",
        r"(?:Дата|Срок сдачи|Дата проверки|Работа сдана)\s*[:\-]?\s*"
        r"«?\s*(?P<value>\d{1,2}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{2,4})\s*»?",
        r"(?P<value>\d{1,2}\s+[а-яА-ЯёЁ]{3,10}\s+\d{4})",
        r"(?P<value>\d{1,2}\s*[а-яА-ЯёЁ]{3,10}\s*\d{4}\s*[гr]?)",
        r"«\s*(?P<value>\d{1,2}\s*[а-яА-ЯёЁ]+\s*\d{4})\s*»"
    ],
    "Подпись": [
        r"Студент:\s*(?P<value>_+)",
        r"(?:Подпись(?:\s+[а-яА-ЯёЁ]+)?|Подпись преподавателя|Подпись руководителя)\s*[:\-]?\s*"
        r"(?P<value>.*?)(?:\n|$)",
        r"(?P<value>[_]{2,}|/{1,3}|\\{1,3}|—{2,})",
        r"(?P<value>[A-Za-zА-Яа-яЁё]{0,3}\s*[/_\\]{1,3}\s*[A-Za-zА-Яа-яЁё]{0,3})"
    ],
}


def clean_fio(value: str | None) -> str | None:
    if not value:
        return None

    value = re.sub(r"\s+", " ", value).strip()

    if re.search(r"\b(групп|посвящен|работ|тема|дата)\b", value.lower()):
        return None

    value = re.sub(r"\.\s*", ". ", value)
    value = re.sub(r"\s+", " ", value).strip()

    return value


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
        for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
            value = clean_value(match.group("value"))

            if not value:
                continue

            if re.search(r"\b(группа|тема|дата|подпись|работа|курсовая)\b", value.lower()):
                continue

            return value

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
            value = extract_field(normalized, field_patterns)

            if field == "ФИО":
                value = clean_fio(value)

            result[field] = value
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


KEY_FIELDS = ["ФИО", "Группа", "Тема", "Дата"]


def normalize_compare_value(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip().lower()


def evaluate_completeness(
    results: list[dict[str, Any]],
) -> tuple[bool, dict[str, set[str | None]]]:

    field_values: dict[str, set[str | None]] = defaultdict(set)

    for item in results:
        if "error" in item:
            continue

        for field in KEY_FIELDS:
            value = normalize_compare_value(item["data"].get(field))
            field_values[field].add(value)

    inconsistencies: dict[str, set[str | None]] = {}

    for field, values in field_values.items():
        if len(values) > 1:
            inconsistencies[field] = values

    return len(inconsistencies) == 0, inconsistencies


def generate_pdf_report(results: list[dict[str, Any]], output_path: str) -> None:
    pdf_canvas = canvas.Canvas(output_path)
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_PATH)))
    pdf_canvas.setFont("DejaVu", 9)

    is_complete, inconsistencies = evaluate_completeness(results)

    y_position = 800


    status = "КОМПЛЕКТ" if is_complete else "НЕ КОМПЛЕКТ"
    pdf_canvas.drawString(50, y_position, f"Статус набора: {status}")
    y_position -= 15

    if inconsistencies:
        pdf_canvas.drawString(50, y_position, "Несоответствия:")
        y_position -= 10

        for field, values in inconsistencies.items():
            readable = [v if v is not None else "—" for v in values]
            pdf_canvas.drawString(60, y_position, f"{field}: {', '.join(readable)}")
            y_position -= 10

        y_position -= 10


    for item in results:
        if y_position < 100:
            pdf_canvas.showPage()
            pdf_canvas.setFont("DejaVu", 9)
            y_position = 800

        if "error" in item:
            pdf_canvas.drawString(
                50, y_position, f"{item['file']} — ОШИБКА: {item['error']}"
            )
            y_position -= 10
            continue

        pdf_canvas.drawString(10, y_position, f"Файл: {item['file']}")
        y_position -= 10

        for key, value in item["data"].items():
            display = value if value else "—"
            pdf_canvas.drawString(20, y_position, f"{key}: {display}")
            y_position -= 10

        y_position -= 8

    pdf_canvas.save()
