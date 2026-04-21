from pydantic import BaseModel

class UserBase(BaseModel):
    login: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool = True

    class Config:
        from_attributes = True

class UserInDB(User):
    hashed_password: str
