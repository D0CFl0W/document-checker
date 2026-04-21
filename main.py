from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from routers import students_checker
from models import sql_users
from databases import sqlite_users_service

app = FastAPI(
    title="Анализатор документов",
    description="API для анализа документов",
    version="0.0"
)

app.mount('/static', StaticFiles(directory='static'), 'static')
templates = Jinja2Templates(directory='templates')
sql_users.sqlite_users_service.Base.metadata.create_all(bind=sqlite_users_service.engine)

app.include_router(students_checker.router)

@app.get("/")
def return_basic(request: Request):
    return templates.TemplateResponse(name='place_holder.html', context={'request': request})

@app.get("/users/")
async def read_users(db: Session = Depends(sqlite_users_service.get_db)):
    users = db.query(sql_users.User).all()
    return users
