from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from schemas.archive import FileDownloadRequest
from services.parser import parse_directory
from services.unpacker import outputing_file

UPLOAD_DIR = Path("files")
DOWNLOAD_DIR = Path("unpacked")

router = APIRouter(
    prefix="/download-report",
    tags=["Выгрузка файлов"]
)

@router.post("")
async def get_report_info(request_data: FileDownloadRequest):
    try:
        # Ищем файл на сервере по сохраненному имени
        name = request_data.saved_name
        file_path = UPLOAD_DIR / name
        s = outputing_file(file_path, DOWNLOAD_DIR)
        return {
            "status": "success",
            "file1": s[0],
            "file2": s[1],
            "file3": s[2],
            "file4": s[3],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при проверке файла: {str(e)}")
