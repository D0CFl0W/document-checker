from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from schemas import users

router = APIRouter(
    prefix="/users",
    tags=["Юзеры"]
)

def pag_params(fName: str = "null", sName: str = "null"):
    return {"fName": fName, "sName": sName}
