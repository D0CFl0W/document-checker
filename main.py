from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(
    title="Анализатор документов",
    description="API для анализа документов",
    version="0.0"
)

app.mount('/static', StaticFiles(directory='static'), 'static')
templates = Jinja2Templates(directory='templates')


@app.get("/")
def return_basic(request: Request):
    return templates.TemplateResponse(name='place_holder.html', context={'request': request})
