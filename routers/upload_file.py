import shutil
import uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, APIRouter
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(
    prefix="/upload-file",
    tags=["Загрузка файлов"]
)

UPLOAD_DIR = Path("files")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("")
async def upload_file(file: UploadFile = File(...)):
    try:
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = UPLOAD_DIR / unique_filename

        with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

        return {
            "message": "Файл успешно загружен",
            "saved_name": unique_filename,
            "original_name": file.filename
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке: {str(e)}")
