# Ch.10 사례 - contains()가 API를 멈추게 한 날

[< 환경 세팅](./README.md) | [Hash Table과 시간 복잡도 >](./02-hash-table.md)

---

앞에서 AI가 만든 코드를 리뷰하는 방법을 봤다. 이번부터는 그 리뷰에서 가장 자주 걸리는 문제를 직접 파고든다. 첫 번째: 자료구조 선택.


## 10-1. 사례 설명

주니어 개발자가 유저 API를 만들고 있다. 요청이 들어올 때마다, 해당 유저가 블랙리스트에 있는지 확인해야 한다. 블랙리스트는 약 1,000명이다.

```python
# 블랙리스트 (서버 시작 시 DB에서 가져와서 메모리에 보관)
blacklist = [10234, 20456, 30789, ...]  # 약 1,000개

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    if user_id in blacklist:  # 여기
        return {"error": "blocked user"}

    user = get_user_from_db(user_id)
    return user
```

잘 동작한다. 개발 환경에서 요청마다 1~2ms 정도. 문제없어 보인다.

그런데 부하 테스트를 돌리면서 블랙리스트를 10만 개로 늘렸더니 응답 시간이 수 초로 뛰었다. 같은 코드인데.


## 10-2. 결과 예측

질문을 던져보자.

- `if user_id in blacklist`에서 `blacklist`가 List일 때, 검색 한 번에 최대 몇 번의 비교가 필요한가?
- `blacklist`가 Set이면?
- 10만 개 데이터에서 1만 번 검색하면 List와 Set의 시간 차이가 얼마나 날 것 같은가?

<!-- 기대 키워드: 시간 복잡도, O(n), O(1), Hash Table, Linear Search -->


## 10-3. 결과 분석

### 실험 1: List vs Set vs Dict 검색 성능

10만 개의 랜덤 정수 데이터를 List, Set, Dict에 각각 담아두고, 1만 번 검색(절반은 존재하는 값, 절반은 없는 값)한 결과다.

| 자료구조 | 검색 시간 | 배율 |
|----------|----------|------|
| List | 4,937ms | 1x (기준) |
| Set | 1.22ms | 4,040x 빠름 |
| Dict | 1.06ms | 4,642x 빠름 |

측정 환경: Apple M3, Python 3.12, `time.perf_counter()` 기준

4,000배가 넘는 차이다. 코드를 바꾸지 않았다. `list_data`를 `set_data`로 바꿨을 뿐이다.

### 실험 2: 블랙리스트 체크 (실무 사례)

1,000개의 블랙리스트에서 10,000명의 유저를 체크한 결과다.

| 방식 | 검색 시간 | 배율 |
|------|----------|------|
| List (in) | 36.76ms | 1x (기준) |
| Set (in) | 0.36ms | 102x 빠름 |

측정 환경: Apple M3, Python 3.12, `time.perf_counter()` 기준

블랙리스트가 1,000개면 102배, 10만 개면 4,000배. 블랙리스트 크기에 비례해서 느려진다는 뜻이다.


## 10-4. 왜 이런 차이가 나는가

같은 `in` 연산자인데 왜 자료구조에 따라 수천 배 차이가 나는가?

List의 `in` 연산자는 처음부터 끝까지 하나씩 비교한다. Linear Search다.

```python
# list의 in 연산자가 내부적으로 하는 일 (의사코드)
def __contains__(self, target):
    for item in self:
        if item == target:
            return True
    return False
```

10만 개짜리 List에서 없는 값을 찾으려면 10만 번 비교해야 한다. 이걸 1만 번 반복하면 10억 번의 비교가 일어난다.

Set과 Dict는 다르다. Hash Table이라는 자료구조를 사용한다. Hash 함수로 값의 위치를 바로 계산해서 한 번만에(또는 몇 번 안에) 찾는다. 10만 개든 100만 개든 검색 시간이 거의 일정하다.

<details>
<summary>Linear Search (선형 탐색)</summary>

데이터를 처음부터 끝까지 하나씩 비교하며 찾는 방법이다. 단순하지만 데이터가 많아질수록 느려진다. List의 `in` 연산자가 이 방식이다. 시간 복잡도는 O(n)이다. Ch.11에서 Binary Search와 비교한다.

</details>

<details>
<summary>Hash Table (해시 테이블)</summary>

키를 Hash 함수로 변환해서 배열의 인덱스로 사용하는 자료구조다. 이론적으로 검색, 삽입, 삭제가 모두 O(1)이다. Python의 `set`과 `dict`가 내부적으로 Hash Table을 사용한다. Java에서는 `HashSet`, `HashMap`이 같은 원리다.

</details>

이 차이를 표현하는 방법이 시간 복잡도(Time Complexity)다. Ch.8에서 프롬프트 키워드로 잠깐 등장했는데, 이제 제대로 다룬다.

| 연산 | List | Set | Dict |
|------|------|-----|------|
| 검색 (in) | O(n) | O(1) | O(1) |
| 삽입 (append/add) | O(1) | O(1) | O(1) |
| 삭제 (remove) | O(n) | O(1) | O(1) |
| 인덱스 접근 | O(1) | 불가 | 불가 |
| 순서 보장 | O | X (3.7+는 삽입순 유지) | X (3.7+는 삽입순 유지) |

(Python 3.7부터 Dict가 삽입 순서를 유지하긴 하는데, 이건 구현 세부사항이지 사양이 아니었다. 3.7에서 사양이 됐다. Set은 여전히 순서를 보장하지 않는다.)

<details>
<summary>Time Complexity (시간 복잡도)</summary>

알고리즘이나 자료구조의 연산이 입력 크기(n)에 따라 얼마나 느려지는지를 표현하는 방법이다. Big-O 표기법을 사용한다. O(1)은 "입력 크기와 무관하게 일정한 시간", O(n)은 "입력 크기에 비례", O(n^2)은 "입력 크기의 제곱에 비례"다. 실무에서는 정확한 수학적 증명보다 "이 연산이 데이터가 커졌을 때 어떻게 되는가"를 판단하는 도구로 쓴다.

</details>

핵심은 이거다: `in` 연산자가 느린 게 아니다. List에서 `in` 연산자를 쓰는 게 느린 거다. 자료구조를 바꾸면 된다.


## 10-5. 코드 설명

벤치마크 코드를 보자.

```python
# csbe-study/csbe_study/routers/datastructure.py (핵심 부분)

import random
import time

# 10만 개의 랜덤 정수 데이터를 세 가지 자료구조로 보관
DATASET_SIZE = 100_000
raw_data = random.sample(range(1, 1_000_001), DATASET_SIZE)

list_data = list(raw_data)
set_data = set(raw_data)
dict_data = {v: True for v in raw_data}

# 검색 대상: 절반은 존재하는 값, 절반은 존재하지 않는 값
SEARCH_COUNT = 10_000
existing_values = random.sample(list_data, SEARCH_COUNT // 2)
missing_values = random.sample(range(1_000_001, 2_000_001), SEARCH_COUNT // 2)
search_targets = existing_values + missing_values
```

중요한 건 "절반은 존재하는 값, 절반은 존재하지 않는 값"이다. 존재하는 값만 검색하면 List에서 평균 절반만 비교하면 되니까 결과가 낙관적으로 나온다. 존재하지 않는 값을 검색할 때가 최악이다 - 끝까지 다 비교해야 하니까.

```python
@router.get("/search/list")
async def search_in_list():
    found = 0
    start = time.perf_counter()
    for target in search_targets:
        if target in list_data:  # O(n) x 10,000번
            found += 1
    elapsed = time.perf_counter() - start
    return {"structure": "list", "elapsed_ms": round(elapsed * 1000, 2), ...}
```

List 검색 엔드포인트다. `if target in list_data`가 10,000번 실행된다. List에서 `in`은 O(n)이니까, 최대 10만 x 1만 = 10억 번의 비교가 일어날 수 있다.

```python
@router.get("/search/set")
async def search_in_set():
    found = 0
    start = time.perf_counter()
    for target in search_targets:
        if target in set_data:  # O(1) x 10,000번
            found += 1
    elapsed = time.perf_counter() - start
    return {"structure": "set", "elapsed_ms": round(elapsed * 1000, 2), ...}
```

Set 검색 엔드포인트다. 코드가 완전히 동일하고, `list_data`가 `set_data`로 바뀌었을 뿐이다. 4,000배 차이가 이 한 단어에서 나온다.

코드 한 줄, 자료구조 선택 하나가 이 정도 차이를 만든다. 다음에서 Hash Table의 내부 동작을 더 자세히 보자.

---

[< 환경 세팅](./README.md) | [Hash Table과 시간 복잡도 >](./02-hash-table.md)
