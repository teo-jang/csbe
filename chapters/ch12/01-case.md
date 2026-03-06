# Ch.12 사례 - 카테고리 트리를 매번 재귀로 조회한다

[< 환경 세팅](./README.md) | [BFS, DFS, 그리고 DAG >](./02-bfs-dfs-dag.md)

---

앞에서 B-Tree라는 "디스크를 위한 트리"를 봤다. 이번에는 애플리케이션 레벨에서 트리를 다루는 문제다.


## 12-1. 사례 설명

쇼핑몰에서 카테고리 트리를 관리한다. 카테고리는 부모-자식 관계로 계층 구조를 이룬다.

```
전자제품
├── 컴퓨터
│   ├── 노트북
│   ├── 데스크탑
│   └── 모니터
├── 스마트폰
│   ├── 안드로이드
│   └── iOS
└── 가전
    ├── TV
    └── 냉장고
```

DB에는 이렇게 저장되어 있다:

```sql
CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    parent_id INT NULL  -- 최상위는 NULL
);
```

주니어 개발자가 "특정 카테고리의 모든 하위 카테고리를 가져오는" API를 재귀로 만들었다.

```python
def get_children(category_id):
    children = db.query(
        "SELECT * FROM categories WHERE parent_id = ?", category_id
    )
    result = []
    for child in children:
        result.append(child)
        result.extend(get_children(child["id"]))  # 재귀 호출
    return result
```

카테고리가 5단계면 잘 동작한다. 그런데 두 가지 문제가 숨어 있다.

1. 재귀 호출마다 DB 쿼리가 발생한다 (N+1 Problem의 트리 버전)
2. 카테고리가 100단계 깊이면 `RecursionError` 발생 (Ch.4의 Stack Overflow)


## 12-2. 결과 예측

- 카테고리가 1,000개이고 평균 깊이가 5단계면 DB 쿼리는 몇 번 발생하는가?
- 깊이가 1,000단계면 Python의 기본 재귀 제한(1,000)에 걸리는가?
- 재귀를 반복문으로 바꾸면 Stack Overflow가 해결되는가?

<!-- 기대 키워드: Tree, BFS, DFS, Stack, Queue, N+1, 재귀, Stack Frame -->


## 12-3. 해결 방법

### 방법 1: 전체를 한 번에 가져와서 메모리에서 트리 구성

```python
def get_all_children(root_id):
    # DB 쿼리 1번으로 전체 카테고리를 가져온다
    all_categories = db.query("SELECT * FROM categories")

    # 메모리에서 부모-자식 관계를 구성 (Dict 사용 → O(1) 검색)
    children_map = {}
    for cat in all_categories:
        parent_id = cat["parent_id"]
        if parent_id not in children_map:
            children_map[parent_id] = []
        children_map[parent_id].append(cat)

    # BFS로 하위 카테고리 수집 (재귀 없음, Stack Overflow 없음)
    result = []
    queue = [root_id]
    while queue:
        current_id = queue.pop(0)
        for child in children_map.get(current_id, []):
            result.append(child)
            queue.append(child["id"])

    return result
```

DB 쿼리 1번, 메모리에서 트리 순회. N+1도 없고 Stack Overflow도 없다.

### 방법 2: DB에서 재귀 쿼리 사용 (CTE)

```sql
WITH RECURSIVE category_tree AS (
    SELECT * FROM categories WHERE id = ?
    UNION ALL
    SELECT c.* FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;
```

MySQL 8.0+, PostgreSQL, SQLite에서 지원하는 재귀 CTE(Common Table Expression)다. DB 엔진이 알아서 재귀를 처리하니까 애플리케이션에서 재귀를 쓸 필요가 없다.

(Python 개발자라면 Django의 `django-treebeard`나 `django-mptt` 같은 라이브러리가 이런 계층 쿼리를 최적화해준다.)


## 12-4. 재귀 vs 반복문

Ch.4에서 봤듯이, 재귀는 함수 호출마다 Stack Frame이 쌓인다. Python의 기본 재귀 제한은 1,000이다.

```python
# 재귀 DFS - Stack Overflow 위험
def dfs_recursive(node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for child in get_children(node):
        if child not in visited:
            dfs_recursive(child, visited)
    return visited

# 반복문 DFS - Stack Overflow 없음 (명시적 Stack 사용)
def dfs_iterative(start):
    visited = set()
    stack = [start]
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        for child in get_children(node):
            stack.append(child)
    return visited
```

반복문 버전은 `list`를 Stack으로 사용한다. Heap 메모리를 사용하니까 Python 재귀 제한에 걸리지 않는다. 실무에서 깊이를 예측할 수 없는 트리는 반복문으로 순회하는 게 안전하다.

---

[< 환경 세팅](./README.md) | [BFS, DFS, 그리고 DAG >](./02-bfs-dfs-dag.md)
