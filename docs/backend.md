# Руководство для бэкенда

## Версия Python

Рекомендуется **3.9+** (в коде используются отложенные аннотации `from __future__ import annotations` там, где нужны `list[str]`, `str | Path` и т.п.).

## Стек

- **FastAPI** — HTTP API и раздача шаблона/статики.
- **Jinja2** — главная страница `templates/index.html`.
- **Pydantic** — схема тела для скачивания отчёта.

## Точки входа

| Модуль | Назначение |
|--------|------------|
| `main.py` | Приложение `app`, mount `/static`, роуты из `routers/`, `GET /` → `index.html`. |
| `routers/upload_file.py` | `POST /upload-archive` — сохранение ZIP в `files/`. |
| `routers/download_file.py` | `POST /download-report` — распаковка, парсинг, PDF в ответ. |

## Директории на диске

| Путь | Назначение |
|------|------------|
| `files/` | Загруженные архивы (имя: `{uuid}_{original_filename}`). |
| `unpacked/` | Распакованные копии (подпапка по stem имени архива). |
| `reports/` | Сгенерированные PDF-отчёты перед отправкой клиенту. |

Папки `files/` и `unpacked/` создаются при необходимости в коде роутера/сервиса.

## Контракт API

### Загрузка

- **Маршрут:** `POST /upload-archive`
- **Параметр:** `archive: UploadFile` (form field `archive`).
- **Ответ 200:** `{"message", "saved_name", "original_name"}`.

### Скачивание отчёта

- **Маршрут:** `POST /download-report`
- **Тело JSON:** модель `FileDownloadRequest` (`schemas/archive.py`):

```python
class FileDownloadRequest(BaseModel):
    message: str
    saved_name: str
    original_name: str
```

Клиент должен повторно отправить тот же JSON, что получил после загрузки (включая `message`).

- **Ответ 200:** `FileResponse` — PDF, `media_type=application/pdf`.

### Ошибки

Исключения в обработчиках превращаются в `HTTPException` с `detail` и кодом `500` (при желании позже можно разнести по кодам).

## Зависимости Python

Используются пакеты (установите в окружение проекта):

- `fastapi`, `uvicorn`, `jinja2`, `python-multipart`
- `python-docx`, `pdfplumber`, `reportlab`

Точный список версий лучше зафиксировать в `requirements.txt` / `pyproject.toml` при появлении в репозитории.

## Запуск локально

Из корня репозитория:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Шрифт для PDF-отчёта: `fonts/DejaVuSans.ttf` (путь задаётся в `services/parser.py`).

## CORS

Если фронт открывается с другого origin, подключите `CORSMiddleware` в `main.py` с нужными `allow_origins`.

## Связь с `services`

Пайплайн «архив → отчёт» инкапсулирован в `services/unpacker.py` (`build_packaged_report`). Подробности парсинга и PDF — в [services.md](services.md).
