from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=50)
    role: str = Field(default="student", pattern="^(student|normocontrol)$")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str


class FileDownloadRequest(BaseModel):
    saved_name: str
    original_name: str
