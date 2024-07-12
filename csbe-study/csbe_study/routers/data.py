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


CONTAINS_COUNT = 100
APPEND_COUNT = 100


@router.get("/complex_in_list/{value}")
async def complex_in_list(
    value: int, contains_multiplier: int = 0, append_multiplier: int = 0
):
    ret = True
    append_value = 1000001

    new_data = list_data[:]

    for _ in range(CONTAINS_COUNT * contains_multiplier):
        ret = value in new_data

    for _ in range(APPEND_COUNT * append_multiplier):
        new_data.append(append_value)
        append_value += 1

    return ret


@router.get("/complex_in_set/{value}")
async def complex_in_list(
    value: int, contains_multiplier: int = 0, append_multiplier: int = 0
):
    ret = True
    append_value = 1000001

    new_data = set(data)

    for _ in range(CONTAINS_COUNT * contains_multiplier):
        ret = value in new_data

    for _ in range(APPEND_COUNT * append_multiplier):
        new_data.add(append_value)
        append_value += 1

    return ret