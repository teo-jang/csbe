# Ch.3 사례: async로 했는데 왜 안 빨라지지?

[< 환경 세팅](./README.md) | [CS Drill Down (1) >](./02-cpu-io-bound.md)

---

환경이 준비됐으면 사례부터 보자.


## 3-1. 사례 설명

Ch.2에서 `print()` 한 줄이 API를 수십~수백 배 느리게 만든다는 걸 확인했다. 원인은 `print()`가 I/O를 유발하기 때문이었다. 매번 `write()` System Call이 호출되고, User Mode와 Kernel Mode를 왕복했다.

여기서 한 가지 시도를 해볼 수 있다. "I/O가 느린 거면, `async`로 바꾸면 빨라지지 않을까?"

실제로 Ch.2에서 만든 `doPrintAsync` 엔드포인트로 테스트해보면 이런 결과가 나온다.

| 엔드포인트 | 평균 응답 시간 | 처리량 (req/s) |
|-----------|-------------|--------------|
| doPrint (동기 print) | 2,160ms | 29 |
| doPrintAsync (비동기 print) | 411ms | 70.8 |
| dontPrint (print 없음) | 15.4ms | 98 |

(측정 환경: M1 MacBook, Python 3.12, uvicorn, PYTHONUNBUFFERED=1, k6 100 VUs / 10s)

비동기 print는 동기보다 약 5배 빠르다. 효과가 있긴 있다. 하지만 print 없는 버전(15.4ms)에 비하면 여전히 27배 느리다.

그래도 방향은 맞는 것 같다. "I/O를 async로 처리하면 빨라진다." 이게 성립하니까.

그러면 이번엔 좀 더 현실적인 사례로 가보자.

---

상황을 하나 그려보자.

주니어 개발자가 이미지 업로드 API를 만들고 있다. 사용자가 이미지를 올리면 서버에서 포맷 변환(RGB 변환)과 회전 처리를 한 뒤, DB에 경로를 저장한다. 이미지 하나 처리하는 데 100ms 정도 걸린다.

처음에는 동기 방식으로 만들었다. 잘 돌아간다. 그런데 "async가 더 빠르다"는 글을 보고 코드를 전부 async로 바꿨다. 이미지 처리 함수에 `async def`를 붙이고, DB 저장도 비동기로 바꿨다.

"이렇게 하면 더 빨라지겠지."

기대와 달리, 성능이 나아지지 않았다. 오히려 느려졌다.


## 3-2. 사례에 대한 결과 예측

이번에는 같은 작업(이미지 업로드 + 변환 + DB 저장)을 4가지 방식으로 처리한다.

1. 동기 (sync): 그냥 순서대로 실행
2. asyncio: `async def`로 선언하고 `await`로 실행
3. ThreadPool: 별도 스레드에서 실행
4. ProcessPool: 별도 프로세스에서 실행

질문을 던진다.

- 4가지 중 어떤 게 가장 빠를 것 같은가?
- asyncio가 빠를 것 같은가? 왜?
- ThreadPool과 ProcessPool의 차이가 있을 것 같은가? 있다면 왜?

잠시 생각해보고, 아래 결과와 비교해보자.

<!-- 기대 키워드: CPU Bound, I/O Bound, GIL, Event Loop, Context Switch, Blocking I/O -->


## 3-3. 사례에 대한 결과 분석

아래는 1.4MB 이미지(8K)를 업로드해서 변환 + DB 저장하는 API를 20명의 동시 사용자로 10초간 부하 테스트한 결과다.

| 방식 | 평균 응답 시간 | p95 응답 시간 | 처리량 (req/s) |
|------|-------------|-----|--------------|
| sync (동기) | 257ms | 404ms | 15.7 |
| asyncio | 1,420ms | 1,440ms | 8.2 |
| ThreadPool | 215ms | 347ms | 16.1 |
| ProcessPool | 313ms | 570ms | 14.9 |

(측정 환경: M1 MacBook, Python 3.12, uvicorn, k6 20 VUs / 10s, 이미지: 1.4MB JPG, MySQL 8.0 localhost/Podman)

<details>
<summary>p95 (95th Percentile, 95번째 백분위수)</summary>

전체 요청 중 95%가 이 시간 이내에 완료됐다는 뜻이다.
평균은 극단적으로 빠르거나 느린 요청에 의해 왜곡될 수 있다. p95는 "대부분의 사용자가 실제로 경험하는 응답 시간"에 가깝다.
실무에서 SLA(Service Level Agreement)를 정할 때 보통 p95나 p99를 기준으로 쓴다.

</details>

예상과 다른 결과가 나왔을 수 있다. 핵심 관찰 포인트:

1. asyncio가 가장 느리다. 동기보다 약 5.5배 느리다.
2. ThreadPool은 동기와 거의 같다. (오히려 약간 빠르다.)
3. ProcessPool은 동기보다 느리다. IPC 오버헤드가 보인다.
4. 가장 빠른 건 ThreadPool이지만, 동기와 극적인 차이는 없다.

"async로 했더니 오히려 느려졌다?"

도입부에서 본 print() 사례에서는 async가 도움이 됐다. 그런데 이미지 처리에서는 async가 최악의 결과를 냈다. 같은 async인데 왜 결과가 정반대인가?

이게 이번 챕터의 핵심 질문이다. 답은 "작업의 성격"에 있다. print는 I/O 작업이고, 이미지 변환은 CPU 작업이다. 이 차이를 이해하지 못하면, "모든 걸 async로 하면 빨라진다"는 오해에서 벗어날 수 없다.

왜 이런 일이 벌어지는지, 코드부터 보자.


## 3-4. 사례에 대한 코드 설명

테스트에 사용된 FastAPI 서버 코드다.

### 이미지 처리 서비스

`csbe-study/csbe_study/service/image.py`:

```python
from PIL import Image


class ImageProcessor:
    @staticmethod
    async def convert_image_async(image_path: str, output_path: str):
        image = Image.open(image_path)
        image = image.convert("RGB")
        image = image.rotate(180)
        image = image.rotate(180)
        image = image.rotate(180)
        image = image.rotate(180)
        image.save(output_path)
        return output_path

    @staticmethod
    def convert_image(image_path: str, output_path: str):
        image = Image.open(image_path)
        image = image.convert("RGB")
        image = image.rotate(180)
        image = image.rotate(180)
        image = image.rotate(180)
        image = image.rotate(180)
        image.save(output_path)
        return output_path
```

두 함수를 잘 보자. `convert_image_async`에 `async def`가 붙어 있다. 그런데 함수 내부에 `await`가 하나도 없다. `Image.open()`, `convert()`, `rotate()`, `save()` 전부 Pillow의 동기 연산이다. CPU가 픽셀을 하나하나 계산하는 작업이다.

여기가 함정이다. `async def`를 붙였다고 해서 함수가 비동기로 동작하는 게 아니다. 내부에서 실제로 CPU를 점유하고 있으면, `async`든 뭐든 그 시간 동안 다른 작업은 실행되지 않는다.

(이 함정은 실무에서 정말 흔하다. "async def로 선언했으니까 비동기겠지?"라고 생각하는 개발자가 많다.)


### 라우터: 4가지 방식 비교

`csbe-study/csbe_study/routers/uploader.py`에서 핵심 부분만 발췌한다.

```python
# 1. 동기 처리: def 핸들러 → FastAPI가 자동으로 threadpool에서 실행한다
@router.post("/upload_sync")
def upload_sync(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)
    ImageProcessor.convert_image(image_path, output_path)
    baseRepository.insert_sync({"image_path": output_path})
    return {"image_path": image_path, "output_path": output_path}


# 2. asyncio 처리: async def인데 CPU 작업을 그대로 실행 → 이벤트 루프를 블로킹한다
@router.post("/upload_asyncio")
async def upload_asyncio(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)
    await asyncio.gather(
        ImageProcessor.convert_image_async(image_path, output_path),
        baseRepository.insert_async({"image_path": output_path}),
    )
    return {"image_path": image_path, "output_path": output_path}


# 3. ThreadPool 처리: CPU 작업을 스레드로 보내지만, GIL 때문에 진짜 병렬 실행은 안 된다
@router.post("/upload_threadpool")
async def upload_threadpool(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        thread_executor, ImageProcessor.convert_image, image_path, output_path
    )
    await loop.run_in_executor(
        thread_executor, baseRepository.insert_sync, {"image_path": output_path}
    )
    return {"image_path": image_path, "output_path": output_path}


# 4. ProcessPool 처리: CPU 작업을 별도 프로세스로 보낸다 → GIL 우회
@router.post("/upload_processpool")
async def upload_processpool(file: UploadFile = File(...)):
    image_path, output_path = _save_image(file)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        process_executor, ImageProcessor.convert_image, image_path, output_path
    )
    baseRepository.insert_sync({"image_path": output_path})
    return {"image_path": image_path, "output_path": output_path}
```

<details>
<summary>asyncio.gather()</summary>

여러 코루틴을 동시에 실행하고, 전부 끝날 때까지 기다리는 함수다.
`await asyncio.gather(task_a(), task_b())`라고 쓰면, task_a와 task_b를 이벤트 루프에 등록하고 둘 다 완료되면 결과를 반환한다.
단, 여기서 "동시에"라는 건 이벤트 루프 안에서의 동시성(Concurrency)이다. 어떤 코루틴이 `await`로 양보해야 다른 코루틴이 실행된다.
만약 코루틴 내부에 `await`가 없으면(우리 사례처럼), 첫 번째 코루틴이 끝날 때까지 두 번째는 시작조차 못 한다. 사실상 순차 실행이 된다.

</details>

<details>
<summary>loop.run_in_executor()</summary>

이벤트 루프 바깥의 스레드/프로세스 풀에서 동기 함수를 실행하는 방법이다.
`await loop.run_in_executor(executor, func, arg1, arg2)` 형태로 사용한다.
첫 번째 인자가 `ThreadPoolExecutor`면 별도 스레드에서, `ProcessPoolExecutor`면 별도 프로세스에서 실행한다.
`None`을 넘기면 기본 스레드풀을 사용한다.
동기 라이브러리(Pillow, requests 등)를 async 코드에서 쓸 때 이벤트 루프를 막지 않으려면 이걸 써야 한다.

</details>

각 방식이 뭘 하는지 정리하면:

| 방식 | 이미지 처리 | DB 저장 | 핵심 |
|------|-----------|---------|------|
| sync | 메인 스레드에서 직접 | 동기 | FastAPI가 자동으로 threadpool에서 실행 |
| asyncio | 이벤트 루프에서 직접 (블로킹) | 비동기 | CPU 작업이 이벤트 루프를 점유 |
| ThreadPool | 별도 스레드 | 동기 (별도 스레드) | GIL 때문에 CPU 작업은 병렬 안 됨 |
| ProcessPool | 별도 프로세스 | 동기 (메인) | 진짜 병렬 실행. 단, IPC 오버헤드 있음 |

<details>
<summary>FastAPI의 def vs async def</summary>

FastAPI에서 핸들러를 `def`로 선언하면, FastAPI는 그 함수를 자동으로 별도 스레드(threadpool)에서 실행한다. 이벤트 루프를 블로킹하지 않으려는 배려다.
반면 `async def`로 선언하면, FastAPI는 그 함수를 이벤트 루프에서 직접 실행한다. 개발자가 "이 함수는 비동기로 잘 작성했어요"라고 선언한 것으로 간주하기 때문이다.
그래서 `async def` 안에서 CPU를 오래 점유하는 작업을 하면, 이벤트 루프 전체가 멈춘다. 다른 요청도 전부 대기하게 된다.

</details>

<details>
<summary>IPC (Inter-Process Communication, 프로세스 간 통신)</summary>

서로 다른 프로세스끼리 데이터를 주고받는 것이다.
ProcessPool을 쓰면, 메인 프로세스에서 워커 프로세스로 함수와 인자를 보내고, 결과를 다시 받아와야 한다. 이 데이터 전송에 직렬화(pickle)와 역직렬화가 필요하고, 그만큼 시간이 든다.
작업 자체가 가볍다면, 이 통신 오버헤드가 작업 시간보다 커서 오히려 느려질 수 있다.

</details>


### k6 테스트 스크립트

`csbe-study/k6/uploader/240615_upload_test.js`:

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 20,        // 동시 사용자 20명
  duration: '10s', // 10초 동안 테스트
};

const imageIndex = 1;  // 8K 이미지 (1.4MB)
const urlIndex = 0;    // 0: sync, 1: asyncio, 2: threadpool, 3: processpool

const images = [
    open('./test_image_1.png'),  // 7KB 작은 이미지
    open('./test_image_2.jpg')   // 1.4MB 8K 이미지
];

const image_filenames = [
    'test_image_1.png',
    'test_image_2.jpg',
];

const urls = [
    'http://127.0.0.1:8000/commiter/upload_sync',
    'http://127.0.0.1:8000/commiter/upload_asyncio',
    'http://127.0.0.1:8000/commiter/upload_threadpool',
    'http://127.0.0.1:8000/commiter/upload_processpool',
];

export default function() {
    const data = {
        file: http.file(images[imageIndex], image_filenames[imageIndex]),
    };
    http.post(urls[urlIndex], data);
    sleep(1);
}
```

Ch.2와 달리 이번에는 파일 업로드 테스트다. `urlIndex`를 바꿔가며 4개 엔드포인트를 각각 테스트한다.

(VU가 100이 아니라 20인 이유: 이미지 업로드는 요청 하나가 무겁다. 1.4MB 이미지를 매번 보내기 때문에, 100명이면 서버 전에 네트워크/디스크 I/O가 병목이 된다. 20명이면 충분히 동시성 차이를 관찰할 수 있다.)

실행 방법:

```bash
# 1. 서버 실행 (csbe-study/csbe_study 디렉토리에서)
cd csbe-study/csbe_study
poetry run uvicorn main:app

# 2. 다른 터미널에서 k6 테스트 (csbe-study 디렉토리에서)
cd csbe-study

# urlIndex를 0~3으로 바꿔가며 테스트
k6 run k6/uploader/240615_upload_test.js \
  --summary-trend-stats "min,avg,med,max,p(95),p(99)"
```

직접 돌려보고, 3-3의 표와 비교해보자.

정리하면: async로 바꿨더니 5배 이상 느려졌다. ThreadPool은 동기와 비슷하다. ProcessPool도 극적인 차이가 없다. 왜 이런 일이 벌어지는가? 작업의 성격, 그러니까 CPU Bound와 I/O Bound의 차이부터 짚어야 한다.

---

[< 환경 세팅](./README.md) | [CS Drill Down (1) - CPU Bound vs I/O Bound >](./02-cpu-io-bound.md)
