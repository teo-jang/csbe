# Ch.4 사례 B: 재귀 API가 특정 입력에서 죽는다

[< Memory Layout](./02-memory-layout.md) | [왜 이렇게 되는가 - Virtual Memory와 OOM >](./04-virtual-memory.md)

---

앞에서 ProcessPool이 왜 메모리를 많이 먹는지 확인했다. 프로세스는 메모리 공간 전체가 별도이고, 스레드는 Stack만 별도다. 그런데 메모리 관련 문제가 하나 더 있다. 이번에는 Stack 쪽이다.


## 4-1. 사례 설명

카테고리 트리를 재귀로 탐색하는 API를 만들었다. 깊이 10인 트리는 잘 되는데, 깊이 1000인 트리에서 `RecursionError: maximum recursion depth exceeded`가 터졌다.

"그러면 `sys.setrecursionlimit(100000)`으로 올리면 되겠지?"

올렸더니 이번에는 RecursionError 대신 프로세스가 아무 메시지 없이 그냥 죽었다. Segmentation Fault.

<details>
<summary>Segmentation Fault</summary>

OS가 허용하지 않은 메모리 영역에 접근할 때, OS가 프로세스를 강제 종료시키는 신호다. 줄여서 "Segfault"라고도 부른다.
Python의 RecursionError는 예외라서 try/except로 잡을 수 있지만, Segfault는 OS 레벨이라 Python이 잡을 수 없다. 프로세스가 그냥 죽는다. 에러 메시지도 남기지 않는 경우가 많아서 디버깅이 매우 어렵다.

</details>

RecursionError → setrecursionlimit → Segfault. 왜 이런 일이 벌어지는 건가?


## 4-2. 결과 예측

- "Python의 기본 재귀 제한은 얼마인가?"
- "sys.setrecursionlimit()으로 올리면 문제가 해결되는가?"
- "Segmentation Fault는 왜 발생하는가?"

<!-- 기대 키워드: Stack, Stack Frame, Stack Overflow, Virtual Memory -->


## 4-3. 결과 분석

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

왜 이런 일이 벌어지는지, 코드를 보고 그 다음에 CS 관점에서 파고든다.


## 4-4. 코드 설명

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

Heap 증가 테스트 엔드포인트도 있다:

```python
@router.get("/heap-growth")
def heap_growth():
    """Heap 메모리 증가 패턴 관찰 (tracemalloc 사용)"""
    tracemalloc.start()
    results = []
    data = []

    for i in range(10):
        data.extend(range(i * 100_000, (i + 1) * 100_000))
        current, peak = tracemalloc.get_traced_memory()
        results.append({
            "items": len(data),
            "current_mb": round(current / (1024 * 1024), 2),
            "peak_mb": round(peak / (1024 * 1024), 2),
        })

    tracemalloc.stop()
    del data
    return results
```

Heap에 데이터가 쌓일수록 메모리가 선형으로 증가한다:

| 항목 수 | Heap 사용량 |
|---------|-----------|
| 100,000 | 3.8 MB |
| 500,000 | 19.1 MB |
| 1,000,000 | 39.1 MB |

Stack은 고정 크기라 넘치면 죽고, Heap은 (거의) 무한히 자라지만 시스템 메모리가 바닥나면 OOM이다. 이게 어떻게 가능한 건가? 앞에서 배운 Memory Layout만으로는 설명이 안 되는 부분이 있다. Virtual Memory가 필요하다.

---

[< Memory Layout](./02-memory-layout.md) | [왜 이렇게 되는가 - Virtual Memory와 OOM >](./04-virtual-memory.md)
