# Ch.12 BFS, DFS, 그리고 DAG

[< 사례 - 카테고리 트리를 매번 재귀로 조회한다](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 트리 순회를 재귀에서 반복문으로 바꾸는 방법을 봤다. 반복문 순회에는 두 가지 방식이 있다: BFS와 DFS.


## BFS (Breadth-First Search, 너비 우선 탐색)

"같은 레벨의 노드를 먼저 방문"하는 방식이다. Queue(FIFO)를 사용한다.

```
순회 순서:
전자제품 → 컴퓨터, 스마트폰, 가전 → 노트북, 데스크탑, 모니터, 안드로이드, iOS, TV, 냉장고
```

```python
from collections import deque

def bfs(start, children_map):
    visited = []
    queue = deque([start])
    while queue:
        node = queue.popleft()   # FIFO: 먼저 넣은 것부터
        visited.append(node)
        for child in children_map.get(node, []):
            queue.append(child)
    return visited
```

(여기서 `collections.deque`를 쓰는 이유: `list.pop(0)`은 O(n)이다. 앞에서 빼면 뒤의 모든 원소를 한 칸씩 당겨야 하니까. `deque.popleft()`는 O(1)이다. Ch.10의 자료구조 선택 기준이 여기서도 적용된다.)


## DFS (Depth-First Search, 깊이 우선 탐색)

"한 방향으로 끝까지 파고들고, 막히면 돌아오는" 방식이다. Stack(LIFO)을 사용한다.

```
순회 순서:
전자제품 → 컴퓨터 → 노트북 → 데스크탑 → 모니터 → 스마트폰 → 안드로이드 → iOS → 가전 → TV → 냉장고
```

```python
def dfs(start, children_map):
    visited = []
    stack = [start]
    while stack:
        node = stack.pop()       # LIFO: 마지막에 넣은 것부터
        visited.append(node)
        for child in reversed(children_map.get(node, [])):
            stack.append(child)
    return visited
```

<details>
<summary>BFS (Breadth-First Search, 너비 우선 탐색)</summary>

같은 깊이의 노드를 먼저 방문하는 탐색 방식이다. Queue(FIFO)를 사용한다. "최단 경로 찾기"에 적합하다. 레벨 단위로 처리해야 하는 경우(조직도의 같은 직급, 카테고리의 같은 깊이)에 쓴다.

</details>

<details>
<summary>DFS (Depth-First Search, 깊이 우선 탐색)</summary>

한 방향으로 끝까지 파고든 뒤 돌아오는 탐색 방식이다. Stack(LIFO)이나 재귀를 사용한다. "모든 경로 탐색"이나 "존재 여부 확인"에 적합하다. 메모리를 BFS보다 적게 사용한다.

</details>


## 언제 BFS, 언제 DFS?

| 상황 | 추천 | 이유 |
|------|------|------|
| 최단 경로 찾기 | BFS | 가까운 것부터 탐색 |
| 모든 경로 탐색 | DFS | 끝까지 가봐야 알 수 있음 |
| 레벨 단위 처리 | BFS | 같은 깊이의 노드를 한꺼번에 |
| 깊이가 매우 깊은 경우 | DFS (반복문) | BFS는 Queue에 모든 형제를 담아야 함 |
| 사이클 감지 | DFS | 방문 중인 노드를 다시 만나면 사이클 |


## DAG: Directed Acyclic Graph

실무에서 그래프가 가장 자주 등장하는 형태가 DAG(방향 비순환 그래프)다.

- 방향(Directed): 간선에 방향이 있다 (A → B는 있지만 B → A는 아닐 수 있다)
- 비순환(Acyclic): 사이클이 없다 (A → B → C → A 같은 순환이 없다)

실무에서 DAG를 만나는 곳:

| 사례 | 노드 | 간선 |
|------|------|------|
| 빌드 시스템 (Maven, Gradle) | 모듈 | 의존 관계 |
| CI/CD 파이프라인 | 작업(Job) | 실행 순서 |
| Airflow/데이터 파이프라인 | Task | 선후행 관계 |
| 패키지 매니저 (pip, npm) | 패키지 | 의존성 |
| Makefile | 빌드 타겟 | 의존 규칙 |

<details>
<summary>DAG (Directed Acyclic Graph, 방향 비순환 그래프)</summary>

간선에 방향이 있고 사이클이 없는 그래프다. 의존 관계, 선후행 관계를 표현하는 데 적합하다. 위상 정렬(Topological Sort)로 실행 순서를 결정할 수 있다. Airflow, Gradle, npm 등이 내부적으로 DAG를 사용한다.

</details>


## 위상 정렬 (Topological Sort)

DAG에서 "의존성 순서대로 나열하기"가 위상 정렬이다.

```
A → B → D
A → C → D
```

위상 정렬 결과: A → B → C → D 또는 A → C → B → D (둘 다 유효)

"A를 먼저 해야 B를 할 수 있다" 류의 순서를 정하는 거다. npm이 패키지를 설치하는 순서, Gradle이 모듈을 빌드하는 순서가 전부 위상 정렬이다.

```python
from collections import deque

def topological_sort(graph):
    # 진입 차수(in-degree) 계산
    in_degree = {node: 0 for node in graph}
    for node in graph:
        for neighbor in graph[node]:
            in_degree[neighbor] = in_degree.get(neighbor, 0) + 1

    # 진입 차수 0인 노드부터 시작
    queue = deque([n for n in in_degree if in_degree[n] == 0])
    result = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor in graph.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(in_degree):
        raise ValueError("사이클이 존재합니다!")

    return result
```

(사이클이 있으면 위상 정렬이 불가능하다. 이걸 역으로 이용해서 사이클 감지에 쓸 수도 있다.)

<details>
<summary>Topological Sort (위상 정렬)</summary>

DAG에서 간선의 방향을 거스르지 않으면서 모든 노드를 나열하는 알고리즘이다. "선행 조건을 먼저 처리"하는 순서를 결정한다. BFS 기반(Kahn's Algorithm)과 DFS 기반 두 가지 방법이 있다. 빌드 시스템, 패키지 매니저, 작업 스케줄러에서 핵심적으로 사용된다.

</details>

---

[< 사례 - 카테고리 트리를 매번 재귀로 조회한다](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
