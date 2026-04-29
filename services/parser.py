import re
from pathlib import Path
from docx import Document
import pdfplumber
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
BASE_DIR = Path(__file__).resolve().parent.parent

FONT_PATH = BASE_DIR / "fonts" / "DejaVuSans.ttf"
def extract_pdf(path: Path) -> str:
    try:
        text_parts = []

        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")

        return "\n".join(text_parts)

    except Exception as e:
        raise ValueError(f"Ошибка чтения PDF {path}: {e}")

def extract_docx(path: Path) -> str:
    try:
        doc = Document(path)
    except Exception as e:
        raise ValueError(f"Ошибка чтения файла {path}: {e}")

    return "\n".join(p.text for p in doc.paragraphs if p.text)

def extract_text(path: Path) -> str:
    if path.suffix.lower() == ".docx":
        return extract_docx(path)
    elif path.suffix.lower() == ".pdf":
        return extract_pdf(path)
    else:
        raise ValueError(f"Неподдерживаемый формат файла: {path.suffix}")

def normalize_text(text: str) -> str:
    text = text.replace('\xa0', ' ')
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


patterns = {
    "ФИО": [
        r"Студенту:\s*(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
        r"ФИО обучающегося:\s*(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
        r"обучающегося\s+(?P<value>[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){2})",
    ],
    "Группа": [
        r"Группа:\s*(?P<value>[A-ЯA-Z0-9\-]+)",
        r"Группы\s*(?P<value>[A-ЯA-Z0-9\-]+)"
    ],
    "Тема": [
        r"Тема ВКР:\s*«(?P<value>.+?)»",
        r"Тема\s*\"(?P<value>.+?)\"",
        r"на тему:\s*«(?P<value>.+?)»",
        r"Тема работы:\s*«(?P<value>.+?)»",
        r"по теме\s*(?P<value>.+?)(?:\(|$)"
    ],
    "Дата": [
        r"Дата:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)",
        r"Срок сдачи студентом.*?:\s*(?P<value>\d{2}\.\d{2}\.\d{2,4}|\[.*?\]|_+)"
    ],
    "Подпись": [
        r"Студент:\s*(?P<value>_+)"
    ]
}


def clean_value(value: str):
    value = value.strip()

    if re.fullmatch(r"_+", value):
        return None
    if re.fullmatch(r"\[.*?\]", value):
        return None

    value = re.sub(r"\s*\(.*?\)\s*$", "", value)
    value = value.lstrip(":").strip()

    return value


def extract_field(text: str, field_patterns: list[str]):
    for pattern in field_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return clean_value(match.group("value"))
    return None


def extract_topic(raw_text: str):
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    for i, line in enumerate(lines):
        if re.search(r"по теме", line, re.IGNORECASE):
            for j in range(i + 1, len(lines)):
                candidate = lines[j].strip()

                if not candidate or candidate.startswith("("):
                    continue

                candidate = re.sub(r"\s*\(.*?\)\s*$", "", candidate)
                return candidate.lstrip(":").strip()

    return None


def parse_document(path: Path) -> dict:
    raw_text = extract_text(path)
    text = normalize_text(raw_text)

    result = {}

    for field, field_patterns in patterns.items():
        if field == "Тема":
            value = extract_field(text, field_patterns)
            if not value:
                value = extract_topic(raw_text)
        else:
            value = extract_field(text, field_patterns)

        result[field] = value

    return result


def parse_directory(directory: str, limit: int | None = 5):
    directory = Path(directory)

    if not directory.exists():
        raise ValueError(f"Директория не существует: {directory}")

    files = sorted(list(directory.glob("*.docx")) + list(directory.glob("*.pdf")))

    if limit:
        files = files[:limit]

    results = []

    for file_path in files:
        try:
            data = parse_document(file_path)
            results.append({
                "file": file_path.name,
                "data": data
            })
        except Exception as e:
            results.append({
                "file": file_path.name,
                "error": str(e)
            })

    return results


def generate_pdf_report(results: list, output_path: str):
    c = canvas.Canvas(output_path)

    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_PATH)))
    c.setFont("DejaVu", 9)

    y = 800

    for item in results:

        if y < 100:
            c.showPage()
            c.setFont("DejaVu", 9)
            y = 800

        if "error" in item:
            c.drawString(50, y, f"{item['file']} — ОШИБКА: {item['error']}")
            y -= 10
            continue

        data = item["data"]

        c.drawString(10, y, f"Файл: {item['file']}")
        y -= 10

        for key, value in data.items():
            c.drawString(20, y, f"{key}: {value if value else '—'}")
            y -= 10

        y -= 9

    c.save()
