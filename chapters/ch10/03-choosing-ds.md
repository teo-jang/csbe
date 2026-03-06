# Ch.10 자료구조 선택의 기준

[< Hash Table과 시간 복잡도](./02-hash-table.md) | [유사 사례와 키워드 정리 >](./04-summary.md)

---

앞에서 Hash Table이 왜 빠른지, 시간 복잡도가 뭔지 확인했다. 이제 실무 질문이다. "그래서 뭘 쓰라는 거냐?"


## 자료구조 선택의 기준: "무엇을 자주 하는가"

자료구조 선택의 핵심은 "이 데이터로 무엇을 하는가"다.

| 주요 연산 | 추천 자료구조 | 이유 |
|----------|-------------|------|
| "이 값이 있는가?" (존재 여부) | Set | O(1) 검색, 중복 제거 |
| "이 키에 해당하는 값은?" (키-값 매핑) | Dict | O(1) 검색 + 값 접근 |
| "순서대로 순회해야 한다" | List | 인덱스 접근 O(1), 순서 보장 |
| "앞에 추가/삭제가 잦다" | deque (collections.deque) | 양쪽 끝 O(1) |
| "항상 최소/최대를 꺼내야 한다" | heapq | 삽입 O(log n), 최소 추출 O(log n) |
| "정렬된 상태를 유지해야 한다" | bisect + List 또는 SortedList | Binary Search O(log n) |

(Java라면 `HashSet`, `HashMap`, `ArrayList`, `ArrayDeque`, `PriorityQueue`, `TreeMap` 등이 대응된다.)


## 실무에서 자주 틀리는 패턴들

### 패턴 1: List에서 `in` 검색

가장 흔한 실수다. 앞에서 본 블랙리스트 사례.

```python
# 나쁜 코드
blacklist = [10234, 20456, 30789, ...]  # List
if user_id in blacklist:  # O(n)

# 좋은 코드
blacklist = {10234, 20456, 30789, ...}  # Set
if user_id in blacklist:  # O(1)
```

List를 Set으로 바꾸는 건 한 줄이다. `[]`를 `{}`로 바꾸거나, `set(list_data)`로 변환하면 된다.

### 패턴 2: List에서 중복 제거 후 검색

```python
# 나쁜 코드
seen = []
for item in data:
    if item not in seen:  # O(n) x n번 = O(n^2)
        seen.append(item)

# 좋은 코드
seen = set()
for item in data:
    if item not in seen:  # O(1) x n번 = O(n)
        seen.add(item)
```

이 패턴은 n이 작을 때는 차이가 안 느껴진다. n이 1만만 넘어도 체감된다.

### 패턴 3: 두 List의 교집합

```python
# 나쁜 코드
common = []
for item in list_a:
    if item in list_b:  # O(m) x n번 = O(n*m)
        common.append(item)

# 좋은 코드
common = set(list_a) & set(list_b)  # O(n+m)
```

Set의 교집합(`&`), 합집합(`|`), 차집합(`-`) 연산은 내부적으로 Hash Table을 활용하기 때문에 훨씬 빠르다.

### 패턴 4: Dict를 안 쓰고 두 List를 사용

```python
# 나쁜 코드
user_ids = [1, 2, 3, 4, 5]
user_names = ["Alice", "Bob", "Charlie", "Dave", "Eve"]

# user_id = 3의 이름을 찾으려면
idx = user_ids.index(3)  # O(n)
name = user_names[idx]

# 좋은 코드
users = {1: "Alice", 2: "Bob", 3: "Charlie", 4: "Dave", 5: "Eve"}
name = users[3]  # O(1)
```

"키로 값을 찾는" 연산이면 Dict가 정답이다.


## 자료구조 선택이 DB에서도 같은 원리라는 것

여기서 잠깐 앞으로 나올 이야기를 맛보자.

DB에서 `SELECT * FROM users WHERE email = 'test@test.com'`을 실행할 때:

- 인덱스가 없으면: 테이블 전체를 순회한다 (Full Table Scan, Linear Search와 같은 원리)
- 인덱스가 있으면: B-Tree 인덱스로 바로 찾는다 (O(log n), Hash Table처럼 바로는 아니지만 매우 빠름)

자료구조 선택이 애플리케이션 레벨에서만 중요한 게 아니다. DB 쿼리 성능도 결국 자료구조 이야기다. Ch.11에서 B-Tree와 인덱스를 다루고, Ch.14에서 실무 인덱스 설계를 본다.


## Set과 Dict의 제약: Hashable

Set과 Dict가 만능은 아니다. Set에 넣으려면 그 값이 Hashable이어야 한다. 즉, `hash()` 함수가 동작해야 한다.

```python
# 가능
s = {1, 2, 3}           # int → hashable
s = {"a", "b", "c"}     # str → hashable
s = {(1, 2), (3, 4)}    # tuple → hashable

# 불가능
s = {[1, 2], [3, 4]}    # list → unhashable! TypeError
s = {{1: 2}}             # dict → unhashable! TypeError
```

Mutable(변경 가능한) 객체는 Hash 값이 바뀔 수 있어서 Hash Table에 넣을 수 없다. List, Dict, Set 자체는 Set의 원소가 될 수 없다. Tuple은 Immutable이니까 가능하다.

(이 제약은 Java에서도 비슷하다. `HashMap`의 키로 사용하려면 `hashCode()`와 `equals()`를 올바르게 구현해야 한다. 커스텀 객체를 Map의 키로 쓸 때 `hashCode()`를 오버라이드하지 않으면 버그가 생긴다.)


## 메모리 트레이드오프

Set과 Dict가 빠른 대신 메모리를 더 쓴다. Hash Table은 내부 배열을 여유 있게 잡아야 충돌을 줄일 수 있기 때문이다.

```python
import sys

data = list(range(10000))
print(f"List: {sys.getsizeof(data):,} bytes")     # List: 87,624 bytes
print(f"Set:  {sys.getsizeof(set(data)):,} bytes") # Set:  524,504 bytes
print(f"Dict: {sys.getsizeof({v:True for v in data}):,} bytes")  # Dict: 295,000 bytes 정도
```

같은 데이터를 담았을 때 Set은 List보다 6배 정도 메모리를 더 쓴다. 이건 Hash Table의 구조적 비용이다.

하지만 이건 보통 걱정할 수준이 아니다. 10만 개 정수의 Set이 약 4MB 정도다. 검색 성능 4,000배 개선의 대가로 4MB를 쓰는 건 거의 모든 서버에서 합리적인 트레이드오프다.

(진짜 메모리가 부족한 상황이라면 Bloom Filter 같은 확률적 자료구조를 고려할 수 있다. "없는 건 확실하고, 있는 건 거의 확실하다" 수준의 판별을 매우 적은 메모리로 한다.)

자료구조 선택은 시간-공간 트레이드오프의 전형적인 예다.

---

[< Hash Table과 시간 복잡도](./02-hash-table.md) | [유사 사례와 키워드 정리 >](./04-summary.md)
