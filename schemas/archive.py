from pydantic import BaseModel

class FileDownloadRequest(BaseModel):
    message: str
    saved_name: str
    original_name: str
