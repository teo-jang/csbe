import asyncio

from fastapi import FastAPI

from csbe_study.routers import uploader
from routers import printer

app = FastAPI()

app.include_router(printer.router)
app.include_router(uploader.router)


@app.get("/")
async def root():
    return {"Hello": "World"}
