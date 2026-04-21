from pydantic import BaseModel

class Student(BaseModel):
    fName: str
    sName: str
