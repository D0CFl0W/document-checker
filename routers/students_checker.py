from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from schemas import student

router = APIRouter(
    prefix="/students",
    tags=["Документы студентов"]
)

def pag_params(fName: str = "null", sName: str = "null"):
    return {"fName": fName, "sName": sName}

@router.post("")
def add_student(student: student.Student):
    db = open("database/fake_base", "r")
    students = db.readlines()
    students = list(map(lambda x: x.split(";"), students))
    new_student = student.dict()
    new_student["id"] = int(students[-1][-1]) + 1
    db.close()
    db = open("database/fake_base", "a")
    db.write(f"{new_student['fName']};{new_student['sName']};{new_student['id']}\n")
    db.close()

@router.get("")
def get_student(pag: dict = Depends(pag_params)):
    db = open("database/fake_base", "r")
    fName = pag["fName"]
    sName = pag["sName"]
    students = db.readlines()
    db.close()
    students = list(map(lambda x: x.split(";"), students))
    print(students)
    for student in students:
        if student[0] == fName and student[1] == sName:
            id = student[2]
            return {"fName": fName, "sName": sName, "id": id}
    raise HTTPException(status_code=404, detail="Студент не найден")
