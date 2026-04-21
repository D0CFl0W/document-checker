from docx import Document
import pdfplumber
def extract_docx(path):
    doc = Document(path)
    lines = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            lines.append(text)
    return lines
def extract_pdf(path):
    lines = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.split("\n"):
                line = line.strip()
                if line:
                    lines.append(line)
    return lines
def value_after_colon(line):
    if ":" in line:
        return line.split(":", 1)[1].strip()
    return None
def set_once(result, key, value):
    if value and not result[key]:
        result[key] = value
def detect_section(line):
    l = line.lower()
    if "фио" in l or "обучающегося" in l or "студент" in l:
        return "fio"
    if "тема" in l:
        return "topic"
    if "группа" in l:
        return "group"
    if "дата" in l or "срок" in l:
        return "date"
    if "подпись" in l:
        return "signature"
    return None
def extract_fields(lines):
    result = {
        "fio": None,
        "group": None,
        "date": None,
        "topic": None,
        "signature": None
    }
    topic_locked = False
    for i, line in enumerate(lines):
        line = line.strip()
        section = detect_section(line)
        if section == "fio":
            val = value_after_colon(line)
            if val:
                set_once(result, "fio", val)
            elif i + 1 < len(lines):
                set_once(result, "fio", lines[i + 1].strip())
        elif section == "topic":
            if topic_locked:
                continue
            val = value_after_colon(line)
            if val:
                result["topic"] = val
                topic_locked = True
            elif i + 1 < len(lines):
                result["topic"] = lines[i + 1].strip()
                topic_locked = True
        elif section == "group":
            val = value_after_colon(line)
            set_once(result, "group", val if val else line)
        elif section == "date":
            val = value_after_colon(line)
            if val:
                set_once(result, "date", val)
            elif i + 1 < len(lines):
                set_once(result, "date", lines[i + 1].strip())
        elif section == "signature":
            result["signature"] = "present"
    return result
def build_report(fields):
    return {
        "ФИО": fields.get("fio"),
        "Группа": fields.get("group"),
        "Дата": fields.get("date"),
        "Тема ВКР": fields.get("topic"),
        "Подпись": fields.get("signature")
    }
def process_document(path):
    if path.endswith(".docx"):
        lines = extract_docx(path)
    elif path.endswith(".pdf"):
        lines = extract_pdf(path)
    else:
        raise ValueError("Unsupported format")
    fields = extract_fields(lines)
    return build_report(fields)
