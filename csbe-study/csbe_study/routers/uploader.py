import asyncio
import os
import uuid
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from http.client import HTTPException

from fastapi import APIRouter, UploadFile, File, BackgroundTasks

from csbe_study.repository.base import BaseRepository
from csbe_study.service.image import ImageProcessor

router = APIRouter(prefix="/commiter", tags=["commit"])

baseRepository = BaseRepository()


@router.on_event("startup")
async def on_startup():
    baseRepository.create_table()
    await baseRepository.create_table_async()


def _save_image(file: UploadFile) -> File:
    filename, file_extension = os.path.splitext(file.filename)
    generated_id = uuid.uuid4()
    image_path = f"tmp/{generated_id}{filename}{file_extension}"
    output_path = f"tmp/{generated_id}{file_extension}"

    with open(image_path, "wb") as f:
        f.write(file.file.read())

    return image_path, output_path


@router.post("/upload_sync")
def upload_sync(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)

    ImageProcessor.convert_image(image_path, output_path)
    baseRepository.insert_sync({"image_path": output_path})

    return {"image_path": image_path, "output_path": output_path}


@router.post("/upload_asyncio")
async def upload_asyncio(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)

    try:
        await asyncio.gather(
            ImageProcessor.convert_image_async(image_path, output_path),
            baseRepository.insert_async({"image_path": output_path}),
        )
    except Exception as e:
        return {"error": str(e)}

    return {"image_path": image_path, "output_path": output_path}


@router.post("/upload_threadpool")
async def upload_threadpool(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as executor:
        await loop.run_in_executor(
            executor, ImageProcessor.convert_image, image_path, output_path
        )
        await loop.run_in_executor(
            executor, baseRepository.insert_sync, {"image_path": output_path}
        )

    return {"image_path": image_path, "output_path": output_path}


@router.post("/upload_processpool")
async def upload_processpool(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)

    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as executor:
        await loop.run_in_executor(
            executor, ImageProcessor.convert_image, image_path, output_path
        )
        await loop.run_in_executor(
            executor, baseRepository.insert_sync, {"image_path": output_path}
        )

    return {"image_path": image_path, "output_path": output_path}


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)

    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as executor:
        await loop.run_in_executor(
            executor, ImageProcessor.convert_image, image_path, output_path
        )

    await baseRepository.insert_async({"image_path": output_path})

    return {"image_path": image_path, "output_path": output_path}


async def process_image_and_save(image_path: str, output_path: str):
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as executor:
        await loop.run_in_executor(
            executor, ImageProcessor.convert_image, image_path, output_path
        )

    await baseRepository.insert_async({"image_path": output_path})


@router.post("/upload_background_task")
async def upload_background_task(
    file: UploadFile = File(...), background_tasks: BackgroundTasks = None
):
    image_path, output_path = _save_image(file)

    background_tasks.add_task(process_image_and_save, image_path, output_path)

    return {"image_path": image_path, "output_path": output_path}
