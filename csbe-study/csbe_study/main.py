from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"Hello": "World"}


@app.get("/doPrint/{message}")
def print_sync(message: str):
    ret = ""
    for _ in range(100):
        for i in range(len(message)):
            ret += message[i]
            print(message[i])

    return {"message": ret}


@app.get("/dontPrint/{message}")
def return_sync(message: str):
    ret = ""
    for _ in range(100):
        for i in range(len(message)):
            ret += message[i]

    return {"message": ret}
