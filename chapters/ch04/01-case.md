# Ch.4 사례와 코드

[< 환경 세팅](./README.md) | [CS Drill Down (1) >](./02-memory-layout.md)

---

Ch.3에서 CPU Bound 작업에는 ProcessPool을 쓰라고 배웠다. "async는 효과 없고, ThreadPool은 GIL 때문에 의미 없고, ProcessPool만이 진짜 병렬"이라는 결론이었다. 이번 챕터는 그 결론의 뒷면을 본다. ProcessPool을 무턱대고 늘리면 어떻게 되는가.


## 4-1. 사례 설명

두 가지 사례를 이야기한다.

### 사례 A: ProcessPool 워커를 늘렸더니 서버가 죽었다

Ch.3에서 이미지 처리를 ProcessPool로 빠르게 만든 개발자가 있다. "워커를 더 늘리면 더 빨라지지 않을까?"라고 생각해서 `ProcessPoolExecutor(max_workers=16)`으로 올렸다.

서버가 시작하자마자 메모리 사용량이 치솟았다. 요청이 들어오기도 전에 이미 1GB를 넘기더니, 부하가 걸리니까 결국 OOM(Out of Memory)으로 프로세스가 죽었다.

"프로세스를 16개 띄운 게 뭐가 그리 대단하다고?"

<details>
<summary>OOM (Out of Memory)</summary>

시스템의 사용 가능한 메모리가 모두 소진된 상태다. Linux에서는 OOM Killer라는 커널 기능이 메모리를 가장 많이 쓰는 프로세스를 강제 종료시킨다. Python에서는 `MemoryError` 예외가 발생하기도 한다.
서버 운영에서 OOM은 무중단 서비스의 적이다. 프로세스가 예고 없이 죽으니까.

</details>


### 사례 B: 재귀 API가 특정 입력에서 죽는다

카테고리 트리를 재귀로 탐색하는 API를 만들었다. 깊이 10인 트리는 잘 되는데, 깊이 1000인 트리에서 `RecursionError: maximum recursion depth exceeded`가 터졌다.

"그러면 `sys.setrecursionlimit(100000)`으로 올리면 되겠지?"

올렸더니 이번에는 RecursionError 대신 프로세스가 아무 메시지 없이 그냥 죽었다. Segmentation Fault.

<details>
<summary>Segmentation Fault</summary>

OS가 허용하지 않은 메모리 영역에 접근할 때, OS가 프로세스를 강제 종료시키는 신호다. 줄여서 "Segfault"라고도 부른다.
Python의 RecursionError는 예외라서 try/except로 잡을 수 있지만, Segfault는 OS 레벨이라 Python이 잡을 수 없다. 프로세스가 그냥 죽는다. 에러 메시지도 남기지 않는 경우가 많아서 디버깅이 매우 어렵다.

</details>

두 사례의 공통점: "프로세스/스레드가 메모리에서 어떻게 존재하는지"를 모르면 원인을 이해할 수 없다.


## 4-2. 사례에 대한 결과 예측

여기서 질문을 던진다.

사례 A:
- "ProcessPool 워커를 1개에서 16개로 올리면, 메모리 사용량은 얼마나 늘어나는가?"
- "같은 조건에서 ThreadPool 16개를 만들면? ProcessPool과 메모리 사용량이 같은가?"

사례 B:
- "Python의 기본 재귀 제한은 얼마인가?"
- "sys.setrecursionlimit()으로 올리면 문제가 해결되는가?"

<!-- 기대 키워드: Process, Thread, Memory Layout, Stack, Heap, Virtual Memory, OOM, RSS -->

잠시 생각해보고, 아래 결과와 비교해보자.


## 4-3. 사례에 대한 결과 분석

### 사례 A: ProcessPool vs ThreadPool 메모리 사용량

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

"프로세스를 16개 띄우면 Python 인터프리터도 16개 띄우는 거다." 이게 사례 A의 핵심이다.


### 사례 B: 재귀 깊이별 결과

| 재귀 깊이 | 결과 | 비고 |
|-----------|------|------|
| 100 | 정상 | |
| 500 | 정상 | |
| 900 | 정상 | |
| 995 | 정상 | 제한 근처 |
| 1000 | RecursionError | Python 기본 제한 (1000) |
| 5000 | RecursionError | 제한 초과 |

Python의 기본 재귀 제한은 `sys.getrecursionlimit()`으로 확인할 수 있다. 기본값은 1000이다. (정확히는 내부 호출 스택을 포함해서 약 995~998 정도에서 걸린다.)

sys.setrecursionlimit(100000)으로 올리면? Python의 소프트웨어 제한은 풀렸지만, OS가 부여한 Stack 크기(보통 8MB)는 그대로다. 재귀가 충분히 깊어지면 OS Stack 크기를 초과해서 Segmentation Fault가 발생한다. 아무 에러 메시지 없이 프로세스가 죽는다.

왜 이런 일이 벌어지는지, 다음 섹션에서 코드를 보고 그 다음에 CS 관점에서 파고든다.


## 4-4. 사례에 대한 코드 설명

### 서버 코드

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

    main_rss = _get_rss_mb()

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

재귀 테스트 엔드포인트:

```python
@router.get("/recursive/{depth}")
def recursive_test(depth: int):
    def _recurse(n, current=0):
        if current >= n:
            return current
        return _recurse(n, current + 1)

    try:
        result = _recurse(depth)
        return {"depth": depth, "result": "success", "recursion_limit": sys.getrecursionlimit()}
    except RecursionError as e:
        return {"depth": depth, "result": "RecursionError", "message": str(e)}
```

`_recurse()`는 depth만큼 자기 자신을 호출한다. 매 호출마다 Stack Frame이 하나씩 쌓인다. Stack Frame이 Stack 영역의 크기를 초과하면? 그게 Stack Overflow다. Python은 그 전에 RecursionError로 막아주지만, setrecursionlimit()으로 이 안전장치를 풀면 OS 레벨의 Stack Overflow(Segfault)가 발생한다.

"ProcessPool 16개가 왜 1GB인지", "재귀 1000번이 왜 죽는지"를 이해하려면 프로세스와 스레드가 메모리에서 어떻게 존재하는지를 알아야 한다.

---

[< 환경 세팅](./README.md) | [CS Drill Down (1) - 메모리에서 프로세스와 스레드는 어떻게 존재하는가 >](./02-memory-layout.md)
