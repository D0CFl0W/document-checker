import re
from pathlib import Path
from docx import Document


def extract_docx(path: Path) -> str:
    try:
        doc = Document(path)
    except Exception as e:
        raise ValueError(f"Ошибка чтения файла {path}: {e}")

    return "\n".join(p.text for p in doc.paragraphs if p.text)


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
    raw_text = extract_docx(path)
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


def parse_directory(directory: str, limit: int = 5):

    directory = Path(directory)

    if not directory.exists():
        raise ValueError(f"Директория не существует: {directory}")

    files = sorted(directory.glob("*.docx"))

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

def res(path: str):
    qwe = parse_directory("unpacked/154eb62b-09f2-425d-8c24-fe345223f3b4_documents_bundle")
    print(qwe)
    return qwe

if __name__ == "__main__":
    res = parse_directory("unpacked/154eb62b-09f2-425d-8c24-fe345223f3b4_documents_bundle")
    print(res)
