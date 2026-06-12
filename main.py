from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from database.database import Base, engine
from routers import authorization, download_file, upload_file

# Создаём таблицы при старте
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Анализатор документов",
    description="API для анализа документов",
    version="1.0",
)

origins = [
    "http://localhost",
    "http://localhost:80",
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(authorization.router)
app.include_router(upload_file.router)
app.include_router(download_file.router)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(
        name="index.html",
        context={"request": request},
    )
