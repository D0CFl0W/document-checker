import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(
    prefix="/upload-archive",
    tags=["Загрузка файлов"],
)

UPLOAD_DIR = Path("files")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("")
async def receive_archive(archive: UploadFile = File(...)):
    try:
        unique_filename = f"{uuid.uuid4()}_{archive.filename}"
        destination = UPLOAD_DIR / unique_filename

        with open(destination, "wb") as buffer:
            shutil.copyfileobj(archive.file, buffer)

        return {
            "message": "Файл успешно загружен",
            "saved_name": unique_filename,
            "original_name": archive.filename,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при загрузке: {exc}",
        ) from exc
