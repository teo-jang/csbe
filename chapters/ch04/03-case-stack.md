# Ch.4 사례 B: 카테고리 경로 조회가 특정 데이터에서 죽는다

[< Memory Layout](./02-memory-layout.md) | [왜 이렇게 되는가 - Stack Frame과 Virtual Memory >](./04-virtual-memory.md)

---

앞에서 ProcessPool이 왜 메모리를 많이 먹는지 확인했다. 프로세스는 메모리 공간 전체가 별도이고, 스레드는 Stack만 별도다. 그런데 메모리 관련 문제가 하나 더 있다. 이번에는 Stack 쪽이다.


## 4-1. 사례 설명

쇼핑몰의 카테고리 트리를 관리하는 API가 있다. 카테고리 구조는 이렇게 생겼다:

```
전체(0) > 의류(1) > 남성(2) > 상의(3) > 티셔츠(4)
```

카테고리는 dict에 ID 기반으로 저장되어 있다. ID만 알면 `categories[id]`로 O(1) 접근이 가능하다.

"특정 카테고리의 경로(breadcrumb)를 구하는 API"가 필요했다. 예를 들어 카테고리 ID 4를 넘기면 `["전체", "의류", "남성", "상의", "티셔츠"]`를 반환하는 거다.

개발자가 이렇게 구현했다: "루트(ID 0)부터 시작해서 재귀적으로 자식을 타고 내려가면서 목표 카테고리를 찾는다."

개발 환경에서는 카테고리가 5~10 레벨 깊이라 잘 돌아갔다. 그런데 외부 분류 체계(산업 표준 분류 코드)를 임포트하면서, 일부 경로가 1000 레벨을 넘겼다. `RecursionError: maximum recursion depth exceeded`가 터졌다.

"그러면 `sys.setrecursionlimit(100000)`으로 올리면 되겠지?"

올렸더니 이번에는 RecursionError 대신 프로세스가 아무 메시지 없이 그냥 죽었다. Segmentation Fault.

<details>
<summary>Segmentation Fault</summary>

OS가 허용하지 않은 메모리 영역에 접근할 때, OS가 프로세스를 강제 종료시키는 신호다. 줄여서 "Segfault"라고도 부른다.
Python의 RecursionError는 예외라서 try/except로 잡을 수 있지만, Segfault는 OS 레벨이라 Python이 잡을 수 없다. 프로세스가 그냥 죽는다. 에러 메시지도 남기지 않는 경우가 많아서 디버깅이 매우 어렵다.

</details>

그런데 사실 이 문제에는 더 근본적인 원인이 있다. 카테고리는 ID로 바로 접근할 수 있다. 목표 카테고리를 ID로 찾아서 parent를 따라 올라가면 재귀 없이 풀리는 문제였다. 루트부터 전체를 탐색할 이유가 없었다.

RecursionError → setrecursionlimit → Segfault. 이 흐름의 CS적 원인을 먼저 파악하고, 그 다음에 "애초에 이렇게 짜면 안 되는 이유"를 본다.


## 4-2. 결과 예측

- "Python의 기본 재귀 제한은 얼마인가?"
- "sys.setrecursionlimit()으로 올리면 문제가 해결되는가?"
- "Segmentation Fault는 왜 발생하는가?"
- "이 문제를 재귀 없이 해결할 수 있는가?"

<!-- 기대 키워드: Stack, Stack Frame, Stack Overflow, Virtual Memory -->


## 4-3. 결과 분석

루트부터 재귀 DFS로 가장 깊은 카테고리를 찾는 경우:

| 트리 깊이 | 재귀 DFS | 직접 조회 (ID → parent) | 비고 |
|-----------|----------|----------------------|------|
| 100 | 정상 | 정상 | |
| 500 | 정상 | 정상 | |
| 900 | 정상 | 정상 | |
| 995 | 정상 | 정상 | 재귀 제한 근처 |
| 1000 | RecursionError | 정상 | Python 기본 제한 (1000) |
| 5000 | RecursionError | 정상 | |
| 100000 | Segfault (제한 해제 시) | 정상 | |

Python의 기본 재귀 제한은 `sys.getrecursionlimit()`으로 확인할 수 있다. 기본값은 1000이다. (정확히는 내부 호출 스택을 포함해서 약 995~998 정도에서 걸린다.)

sys.setrecursionlimit(100000)으로 올리면? Python의 소프트웨어 제한은 풀렸지만, OS가 부여한 Stack 크기(보통 8MB)는 그대로다. 재귀가 충분히 깊어지면 OS Stack 크기를 초과해서 Segmentation Fault가 발생한다. 아무 에러 메시지 없이 프로세스가 죽는다.

한편, "ID로 직접 접근 후 parent를 따라 올라가는" 방식은 깊이가 10만이든 100만이든 정상 동작한다. 재귀가 아니라 while 루프이기 때문이다.

왜 이런 일이 벌어지는지, 코드를 보고 그 다음에 CS 관점에서 파고든다.


## 4-4. 코드 설명

먼저 카테고리 트리를 만드는 함수:

```python
def _build_category_tree(depth):
    """깊이 depth인 일직선 카테고리 트리를 생성한다.
    ID를 키로 쓰므로 O(1) 직접 접근이 가능한 구조다."""
    tree = {}
    for i in range(depth):
        tree[i] = {
            "name": f"category-{i}",
            "parent_id": i - 1 if i > 0 else None,
        }
    return tree
```

dict의 키가 카테고리 ID다. `tree[42]`로 ID 42번 카테고리에 O(1)로 바로 접근할 수 있다.

문제의 코드 - 루트부터 재귀 DFS로 탐색:

```python
def _find_from_root_recursive(tree, target_id, current_id=0):
    """루트부터 재귀 DFS로 타겟 카테고리를 찾는다 (비효율적)"""
    if current_id == target_id:
        return [tree[current_id]["name"]]
    # 현재 노드의 자식을 찾기 위해 전체 트리를 순회한다
    children = [cid for cid, cat in tree.items() if cat["parent_id"] == current_id]
    for child_id in children:
        result = _find_from_root_recursive(tree, target_id, child_id)
        if result is not None:
            return [tree[current_id]["name"]] + result
    return None
```

이 함수의 문제는 두 가지다:
1. 루트에서 아래로 내려가면서 모든 자식을 순회한다. 트리 깊이만큼 재귀가 깊어진다.
2. 자식을 찾기 위해 매번 전체 dict를 순회한다 (`cat["parent_id"] == current_id`). 노드 N개, 깊이 D면 O(N x D)다.

매 호출마다 Stack Frame이 하나씩 쌓인다. 일직선 트리에서 깊이 1000이면 Stack Frame이 1000개 이상 쌓인다. Stack Frame이 Stack 영역의 크기를 초과하면? 그게 Stack Overflow다. Python은 그 전에 RecursionError로 막아주지만, setrecursionlimit()으로 이 안전장치를 풀면 OS 레벨의 Stack Overflow(Segfault)가 발생한다.

해결책 - ID로 직접 접근 후 parent를 따라 올라가기:

```python
def _find_by_direct_lookup(tree, target_id):
    """ID로 직접 접근 후 parent를 따라 올라간다 (효율적)"""
    path = []
    current = target_id
    while current is not None:
        path.append(tree[current]["name"])
        current = tree[current]["parent_id"]
    return list(reversed(path))
```

이 함수는 재귀를 쓰지 않는다. while 루프로 parent를 따라 올라갈 뿐이다. Stack Frame은 함수 하나분만 쓴다. 트리 깊이가 100만이어도 Stack Overflow가 발생하지 않는다. `tree[target_id]`로 O(1) 접근, parent 체인을 따라 올라가는 게 O(depth). 총 O(depth)다.

엔드포인트:

```python
@router.get("/category/recursive/{depth}")
def category_recursive_search(depth: int):
    tree = _build_category_tree(depth)
    target_id = depth - 1  # 가장 깊은 카테고리
    try:
        result = _find_from_root_recursive(tree, target_id)
        return {"depth": depth, "method": "recursive_dfs", "result": "success", ...}
    except RecursionError as e:
        return {"depth": depth, "method": "recursive_dfs", "result": "RecursionError", ...}

@router.get("/category/iterative/{depth}")
def category_iterative_search(depth: int):
    tree = _build_category_tree(depth)
    target_id = depth - 1
    result = _find_by_direct_lookup(tree, target_id)
    return {"depth": depth, "method": "direct_lookup", "result": "success", ...}
```

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

[< Memory Layout](./02-memory-layout.md) | [왜 이렇게 되는가 - Stack Frame과 Virtual Memory >](./04-virtual-memory.md)
