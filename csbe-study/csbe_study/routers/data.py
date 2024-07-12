from fastapi import APIRouter
import random

router = APIRouter(prefix="/iterator", tags=["iterate"])

data = random.sample(range(1, 1000001), 10000)

list_data = list(data)
set_data = set(data)

ACTION_COUNT = 1000


@router.get("/find_in_list/{value}")
async def find_in_list(value: int):
    ret = True
    for _ in range(ACTION_COUNT):
        ret = value in list_data

    return ret


@router.get("/find_in_set/{value}")
async def find_in_set(value: int):
    ret = True
    for _ in range(ACTION_COUNT):
        ret = value in set_data

    return ret
