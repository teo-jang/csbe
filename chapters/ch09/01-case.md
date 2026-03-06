# Ch.9 사례: AI가 자신 있게 틀린 코드들

[< 환경 세팅](./README.md) | [AI가 자주 틀리는 패턴 >](./02-common-mistakes.md)

---

Ch.7에서 "AI는 자신 있게 틀린다(Hallucination)"고 했다. 이번에는 실제로 AI가 만든 코드에서 CS 관점으로 문제를 찾아내는 연습을 한다. 세 가지 사례를 보여주겠다.


## 9-1. 사례 A: 동시성을 무시한 코드

AI에게 "상품 재고를 차감하는 API를 만들어줘"라고 했다. AI가 준 코드:

```python
@app.post("/orders")
async def create_order(item_id: int, quantity: int):
    item = await db.get(Item, item_id)
    if item.stock >= quantity:
        item.stock -= quantity
        await db.commit()
        return {"status": "success", "remaining": item.stock}
    raise HTTPException(400, "재고 부족")
```

코드가 깔끔하다. 문법 오류도 없고, 로직도 맞아 보인다. curl로 한 번 호출하면 잘 동작한다.

그런데 이 코드를 운영에 올리면?

```
시간    스레드A                  스레드B
─────────────────────────────────────────
t1      item.stock = 10 (읽기)
t2                               item.stock = 10 (읽기)
t3      10 >= 3 → True
t4                               10 >= 3 → True
t5      item.stock = 7 (쓰기)
t6                               item.stock = 7 (쓰기)  ← 원래 4여야 함
t7      commit
t8                               commit
```

Ch.5에서 봤다. Race Condition이다. 두 스레드가 동시에 `stock = 10`을 읽고, 각자 3을 빼서 7로 쓴다. 6을 빼야 하는데 3만 빠졌다.

<!-- 기대 키워드: Race Condition, Critical Section, SELECT FOR UPDATE, Atomic -->

### 뭘 놓쳤는가?

AI는 "재고를 차감한다"는 기능은 구현했지만, "동시 접근"이라는 조건을 고려하지 않았다. 왜? 프롬프트에 동시성 관련 키워드가 없었기 때문이다. AI는 단일 요청 기준으로 정상 동작하는 코드를 만든 거다.

CS를 아는 사람은 이 코드를 보는 순간 "읽고 쓰기 사이에 다른 스레드가 끼어들 수 있다"는 걸 안다. `SELECT ... FOR UPDATE`나 Atomic 연산으로 바꿔야 한다는 걸 안다. CS를 모르면 "잘 되는데 뭐가 문제야?"라고 넘어가고, 운영에서 재고가 음수가 된 다음에야 알게 된다.


## 9-2. 사례 B: 성능을 무시한 코드

AI에게 "사용자 목록에서 특정 이메일을 가진 사용자를 찾아줘"라고 했다. AI가 준 코드:

```python
def find_user_by_email(users: list[User], email: str) -> User | None:
    for user in users:
        if user.email == email:
            return user
    return None
```

문법 오류 없고, 로직도 맞다. 사용자가 100명이면 잘 동작한다.

사용자가 100만 명이면?

| 사용자 수 | 평균 검색 시간 |
|----------|--------------|
| 100 | < 1ms |
| 10,000 | ~5ms |
| 1,000,000 | ~500ms |

100만 건 리스트를 처음부터 끝까지 순회하는 O(n) 검색이다. 이걸 요청마다 하면 API가 느려진다.

### 뭘 놓쳤는가?

AI는 "찾는다"라는 기능은 구현했지만, 데이터 규모를 고려하지 않았다. Ch.10에서 다루는 "자료구조 선택"의 문제다.

CS를 아는 사람은 "리스트 순회는 O(n)이다. Dict(Hash Map)로 바꾸면 O(1)이다"라는 걸 안다:

```python
# O(1) 검색
user_by_email = {u.email: u for u in users}  # 딱 한 번만 만든다
user = user_by_email.get(email)
```

아니면 더 근본적으로, "100만 건이면 메모리에 전부 올리지 말고 DB에서 인덱스로 조회해야 한다"는 판단을 내릴 수 있다.


## 9-3. 사례 C: 불필요한 추상화

AI에게 "설정 값을 관리하는 코드를 만들어줘"라고 했다. AI가 준 코드:

```python
from abc import ABC, abstractmethod

class ConfigProvider(ABC):
    @abstractmethod
    def get(self, key: str) -> str: ...

class EnvironmentConfigProvider(ConfigProvider):
    def get(self, key: str) -> str:
        return os.environ.get(key, "")

class FileConfigProvider(ConfigProvider):
    def __init__(self, path: str):
        self.path = path
        with open(path) as f:
            self._data = json.load(f)

    def get(self, key: str) -> str:
        return self._data.get(key, "")

class ConfigProviderFactory:
    @staticmethod
    def create(provider_type: str) -> ConfigProvider:
        if provider_type == "env":
            return EnvironmentConfigProvider()
        elif provider_type == "file":
            return FileConfigProvider("config.json")
        raise ValueError(f"Unknown provider: {provider_type}")
```

Abstract class, 구체 구현 2개, Factory 패턴. 디자인 패턴을 제대로 적용한 것처럼 보인다.

그런데 이 프로젝트에서 설정 소스가 환경 변수 하나뿐이라면?

```python
# 이게 끝이다
import os
config = os.environ.get("MY_CONFIG", "default")
```

한 줄이면 되는 걸 40줄로 만들었다.

### 뭘 놓쳤는가?

AI는 "확장 가능한 설계"를 했지만, "지금 필요한 것"을 하지 않았다. 이건 소프트웨어 공학에서 말하는 YAGNI(You Ain't Gonna Need It) 원칙 위반이다. 미래에 설정 소스가 추가될 수도 있지만, 그때 리팩토링해도 된다.

AI는 훈련 데이터에서 "디자인 패턴 적용 예시"를 많이 봤기 때문에, 물어보면 패턴을 적용한다. 적용이 필요한 상황인지 아닌지는 개발자가 판단해야 한다.


## 9-4. 세 사례의 공통점

| 사례 | AI가 한 것 | AI가 못 한 것 | 검증에 필요한 CS |
|------|-----------|-------------|----------------|
| A | 기능 구현 | 동시성 고려 | Race Condition, Lock (Ch.5) |
| B | 기능 구현 | 성능 고려 | Time Complexity, 자료구조 선택 (Ch.10) |
| C | 패턴 적용 | 적절성 판단 | YAGNI, 관심사의 분리 (Ch.20) |

AI는 "기능"을 만드는 데는 뛰어나다. 하지만 "그 기능이 실제 환경에서 안전하고 효율적인가"를 판단하는 건 사람의 몫이다. 그리고 그 판단에 필요한 게 CS 지식이다.

다음에서 AI가 자주 틀리는 패턴을 좀 더 체계적으로 정리한다.

---

[< 환경 세팅](./README.md) | [AI가 자주 틀리는 패턴 >](./02-common-mistakes.md)
