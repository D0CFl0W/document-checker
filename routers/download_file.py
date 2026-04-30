from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from schemas.archive import FileDownloadRequest
from services.unpacker import build_packaged_report

UPLOAD_DIR = Path("files")
DOWNLOAD_DIR = Path("unpacked")

router = APIRouter(
    prefix="/download-report",
    tags=["Выгрузка файлов"],
)


@router.post("")
async def get_report_info(request_data: FileDownloadRequest):
    try:
        archive_path = UPLOAD_DIR / request_data.saved_name
        report_basename = request_data.saved_name.split(".", 1)[0]
        report_path = build_packaged_report(
            archive_path,
            DOWNLOAD_DIR,
            report_basename,
        )
        original_stem = request_data.original_name.rsplit(".", 1)[0]
        return FileResponse(
            path=report_path,
            filename=f"Report_{original_stem}.pdf",
            media_type="application/pdf",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при проверке файла: {exc}",
        ) from exc
