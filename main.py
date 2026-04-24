from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from routers import upload_file, download_file

app = FastAPI(
    title="Анализатор документов",
    description="API для анализа документов",
    version="0.0"
)

app.mount('/static', StaticFiles(directory='static'), 'static')
templates = Jinja2Templates(directory='templates')

app.include_router(upload_file.router)
app.include_router(download_file.router)

@app.get("/")
def return_basic(request: Request):
    return templates.TemplateResponse(name='index.html', context={'request': request})
