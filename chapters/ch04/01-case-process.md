# Ch.4 사례 A: ProcessPool 워커를 늘렸더니 메모리가 터졌다

[< 환경 세팅](./README.md) | [왜 이렇게 되는가 - Memory Layout >](./02-memory-layout.md)

---

Ch.3에서 CPU Bound 작업에는 ProcessPool이 효과적이라는 걸 확인했다. GIL 때문에 ThreadPool은 CPU Bound에서 성능 이점이 없고, asyncio도 마찬가지였다. 그래서 이미지 처리를 ProcessPool로 바꿨더니 확실히 빨라졌다.

그런데 여기서 자연스러운 질문이 하나 나온다. "워커를 몇 개로 설정하는 게 좋을까?"


## 4-1. 사례 설명

Ch.3에서 이미지 처리를 ProcessPool로 빠르게 만든 개발자가 있다. `ProcessPoolExecutor(max_workers=4)`로 시작했는데, 서버 코어가 8개라 "좀 더 늘리면 더 빨라지지 않을까?" 싶어서 16으로 올려봤다.

서버가 시작하자마자 메모리 사용량이 치솟았다. 요청이 들어오기도 전에 이미 1GB를 넘기더니, 부하가 걸리니까 결국 OOM(Out of Memory)으로 프로세스가 죽었다.

"16개가 좀 많았나? 그럼 적절한 개수는 과연 몇 개인 거지?"

<details>
<summary>OOM (Out of Memory)</summary>

시스템의 사용 가능한 메모리가 모두 소진된 상태다. Linux에서는 OOM Killer라는 커널 기능이 메모리를 가장 많이 쓰는 프로세스를 강제 종료시킨다. Python에서는 `MemoryError` 예외가 발생하기도 한다.
서버 운영에서 OOM은 무중단 서비스의 적이다. 프로세스가 예고 없이 죽으니까.

</details>

이 질문에 답하려면 먼저 "ProcessPool 워커 1개가 메모리를 얼마나 차지하는가"를 알아야 한다.


## 4-2. 결과 예측

여기서 질문을 던진다.

- "ProcessPool 워커를 1개에서 16개로 올리면, 메모리 사용량은 얼마나 늘어나는가?"
- "같은 조건에서 ThreadPool 16개를 만들면? ProcessPool과 메모리 사용량이 같을까, 다를까?"
- "다르다면, 왜?"

<!-- 기대 키워드: Process, Thread, Memory Layout, Heap, RSS -->

잠시 생각해보고, 아래 결과와 비교해보자.


## 4-3. 결과 분석

워커만 생성하고 (추가 메모리 할당 없이) 각 워커의 RSS를 측정했다.

| 시나리오 | 워커 수 | 워커당 RSS | 총 RSS (메인 포함) | 비고 |
|----------|---------|-----------|-------------------|------|
| ProcessPool | 1 | ~60 MB | ~127 MB | 기준선 |
| ProcessPool | 4 | ~60 MB | ~308 MB | |
| ProcessPool | 8 | ~60 MB | ~550 MB | |
| ProcessPool | 16 | ~60 MB | ~1,031 MB | 1GB 돌파 |
| ThreadPool | 16 | - | ~68 MB | ProcessPool의 1/15 |

(측정 환경: M1 MacBook, Python 3.12, uvicorn, macOS)

ProcessPool 워커 16개 = 총 1GB. ThreadPool 워커 16개 = 68MB. 약 15배 차이다.

(참고: "총 RSS"는 메인 프로세스 + 각 워커의 RSS를 단순 합산한 값이다. 실제 물리 메모리 점유는 Copy-on-Write 등의 이유로 이보다 적을 수 있다. 이 부분은 유사 사례에서 다시 다룬다.)

ProcessPool은 워커가 늘어날 때마다 메모리가 워커 수에 비례해서 증가한다. 워커 1개당 ~60MB. 이건 Python 런타임 자체가 차지하는 메모리다. ThreadPool은 워커를 16개로 올려도 메모리가 거의 안 늘어난다. 전부 같은 프로세스(PID 동일) 안에서 돌아가기 때문이다.

"프로세스를 16개 띄우면 Python 인터프리터도 16개 띄우는 거다." 이게 핵심이다. 그런데 왜 프로세스는 이렇게 비싸고, 스레드는 싼 걸까?


## 4-4. 코드 설명

`csbe-study/csbe_study/routers/memory.py`:

```python
import os
import sys
import resource
import threading
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

from fastapi import APIRouter

router = APIRouter(prefix="/memory", tags=["memory"])


def _get_rss_mb():
    """현재 프로세스의 max RSS를 MB 단위로 반환"""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    if sys.platform == "darwin":
        return usage.ru_maxrss / (1024 * 1024)  # macOS: bytes
    else:
        return usage.ru_maxrss / 1024  # Linux: KB
```

`resource.getrusage(resource.RUSAGE_SELF)`는 현재 프로세스의 리소스 사용량을 반환한다. `ru_maxrss`는 최대 RSS(Resident Set Size)다. 이걸로 "이 프로세스가 물리 메모리를 얼마나 점유했는가"를 측정한다.

ProcessPool 테스트 엔드포인트:

```python
def _process_worker_info():
    """프로세스 워커에서 자신의 PID와 RSS를 반환"""
    return {
        "pid": os.getpid(),
        "rss_mb": round(_get_rss_mb(), 2),
    }


@router.get("/process-test/{count}")
def process_test(count: int):
    main_rss = _get_rss_mb()

    with ProcessPoolExecutor(max_workers=count) as executor:
        futures = [executor.submit(_process_worker_info) for _ in range(count)]
        workers = [f.result() for f in futures]

    return {
        "worker_type": "process",
        "worker_count": count,
        "main_process": {"pid": os.getpid(), "rss_mb": round(main_rss, 2)},
        "workers": workers,
        "total_rss_mb": round(main_rss + sum(w["rss_mb"] for w in workers), 2),
        "unique_pids": len(set(w["pid"] for w in workers)),
    }
```

핵심은 `_process_worker_info()`가 각 워커 프로세스 안에서 실행된다는 거다. `os.getpid()`가 각각 다른 PID를 반환한다. 메인 프로세스와는 완전히 별개의 프로세스다.

ThreadPool 테스트 엔드포인트:

```python
@router.get("/thread-test/{count}")
def thread_test(count: int):
    with ThreadPoolExecutor(max_workers=count) as executor:
        futures = [executor.submit(_thread_worker_info) for _ in range(count)]
        workers = [f.result() for f in futures]
        main_rss = _get_rss_mb()  # 스레드가 아직 살아있는 동안 측정

    return {
        "worker_type": "thread",
        "worker_count": count,
        "main_process": {"pid": os.getpid(), "rss_mb": round(main_rss, 2)},
        "workers": workers,
        "total_rss_mb": round(main_rss, 2),
        "unique_pids": len(set(w["pid"] for w in workers)),
    }
```

스레드 워커는 `os.getpid()`가 전부 같은 값이다. 메인 프로세스와 같은 프로세스 안에서 돌아간다. RSS도 전부 같은 값이다. 같은 메모리 공간을 공유하니까.

ProcessPool은 왜 워커당 60MB씩 먹는데, ThreadPool은 왜 거의 안 늘어나는가? 이걸 이해하려면 프로세스와 스레드가 메모리에서 어떻게 존재하는지를 알아야 한다.

---

[< 환경 세팅](./README.md) | [왜 이렇게 되는가 - Memory Layout >](./02-memory-layout.md)
