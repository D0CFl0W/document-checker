from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from schemas.archive import FileDownloadRequest

UPLOAD_DIR = Path("files")

router = APIRouter(
    prefix="/download-report",
    tags=["Выгрузка файлов"]
)

@router.post("")
async def download_report(request_data: FileDownloadRequest):
    try:
        # Ищем файл на сервере именно по saved_name (уникальному имени)
        file_path = UPLOAD_DIR / request_data.saved_name

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="Файл не найден на сервере")

        return FileResponse(
            path=file_path,
            # Можно вернуть файл под его оригинальным именем
            filename=request_data.original_name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при отдаче файла: {str(e)}")
