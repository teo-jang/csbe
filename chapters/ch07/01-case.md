# Ch.7 사례: 같은 문제, 다른 프롬프트

[< 환경 세팅](./README.md) | [AI 코딩 도구의 작동 원리 >](./02-how-ai-coding-works.md)

---

Part 1에서 6개 챕터에 걸쳐 CS 키워드를 쌓았다. 이번에는 그 키워드가 "AI 도구를 쓸 때" 어떤 차이를 만드는지 본다. 세 가지 사례를 보여주겠다. 전부 같은 문제를 두 사람이 다른 프롬프트로 물어보는 구조다.


## 7-1. 사례 A: 데이터가 크다, 줄여줘

### 상황

백엔드 API가 사용자 권한 정보를 JSON으로 내려준다. 권한 플래그가 10개다.

```json
{
  "is_admin": false,
  "is_editor": true,
  "is_viewer": true,
  "is_commenter": false,
  "is_moderator": false,
  "is_uploader": true,
  "is_reviewer": false,
  "is_approver": false,
  "is_auditor": false,
  "is_owner": false
}
```

이걸 모바일 API로 내려주는데, IoT 장비나 저대역폭 환경까지 고려하면 바이트 하나가 아쉽다. 개발자가 AI에게 "줄여달라"고 했다.

(웹 백엔드에서는 이 정도 크기가 병목이 될 일은 거의 없다. 하지만 임베디드나 프로토콜 설계에서는 bit packing이 진짜 자주 쓰인다. 백엔드에서도 DB에 권한을 TINYINT 하나로 저장하거나, Protocol Buffer 같은 바이너리 직렬화를 설계할 때 같은 원리가 적용된다.)


### 주니어 A의 프롬프트 (키워드 없음)

```
이 JSON 데이터 크기를 줄이고 싶어. 방법 좀 알려줘.
```

AI의 응답 (요약):

```
1. gzip 압축을 적용하세요
   - FastAPI에 GZipMiddleware를 추가하면 됩니다

2. 필드명을 줄이세요
   - "is_admin" → "ia", "is_editor" → "ie"

3. 불필요한 필드를 제거하세요
   - 클라이언트가 안 쓰는 필드는 빼세요
```

틀린 답은 아니다. gzip도 방법이고, 필드명을 줄이는 것도 방법이다. 그런데 이 답은 "JSON을 어떻게든 줄여보겠다"는 관점이다. 문제의 본질을 못 짚었다.


### 주니어 B의 프롬프트 (키워드 있음)

```
사용자 권한 boolean flag 10개를 API로 내려줘야 한다.
매번 JSON으로 보내면 낭비다. bit packing으로 정수 하나에 합칠 수 있는가?
Python에서 비트 연산으로 encode/decode 함수를 만들어줘.
```

AI의 응답 (요약):

```python
# 각 권한을 비트 위치로 정의
ADMIN     = 1 << 0   # 1
EDITOR    = 1 << 1   # 2
VIEWER    = 1 << 2   # 4
COMMENTER = 1 << 3   # 8
MODERATOR = 1 << 4   # 16
# ...

def encode_permissions(flags: dict) -> int:
    """boolean 10개를 정수 하나로 합친다"""
    result = 0
    if flags.get("is_admin"): result |= ADMIN
    if flags.get("is_editor"): result |= EDITOR
    # ...
    return result

def decode_permissions(value: int) -> dict:
    """정수 하나를 boolean 10개로 풀어낸다"""
    return {
        "is_admin": bool(value & ADMIN),
        "is_editor": bool(value & EDITOR),
        # ...
    }

# 예: {"is_editor": True, "is_viewer": True, "is_uploader": True}
# → encode → 0b0000100110 → 38
# → API 응답: {"permissions": 38}
```

10개의 boolean(JSON으로 약 200바이트)이 정수 하나(최대 3바이트)로 줄었다. gzip 같은 범용 압축이 아니라, 데이터의 구조를 이해한 압축이다.

### 차이가 뭔가?

A는 "크기를 줄여줘"라고 했다. AI는 범용적인 압축 기법을 추천했다. B는 "bit packing"이라는 키워드를 알고 있었다. AI는 곧바로 비트 연산 코드를 생성했다.

B가 bit packing을 처음부터 알고 있었던 건 아닐 수 있다. 하지만 "boolean 여러 개를 하나의 정수에 합치는 기법이 있다"는 CS 수업 기억이 검색 키워드가 됐고, 그게 프롬프트에 들어간 거다.


## 7-2. 사례 B: API가 느리다, 최적화해줘

### 상황

사용자 목록을 조회하는 API가 느리다. DB에 사용자가 10만 명쯤 있고, email로 검색하는 기능이다.

```python
@app.get("/users")
def search_users(email: str):
    return db.query(User).filter(User.email == email).all()
```

curl로 한 번 쳐보면 2~3초 걸린다. 이건 너무 느리다.


### 주니어 A의 프롬프트 (키워드 없음)

```
사용자 검색 API가 너무 느립니다. 성능 최적화 방법을 알려주세요.
```

AI의 응답 (요약):

```
1. Redis 캐시를 도입하세요
   - 검색 결과를 Redis에 캐싱하면 반복 요청이 빨라집니다

2. 페이지네이션을 추가하세요
   - limit/offset으로 결과를 나눠서 반환하세요

3. 비동기 처리를 적용하세요
   - async/await으로 바꾸면 동시 처리가 가능합니다

4. 데이터베이스 연결 풀을 설정하세요
   - SQLAlchemy의 pool_size를 늘리세요
```

전부 "해도 되는 일"이다. 틀린 말은 없다. 그런데 문제의 원인을 짚지 못했다. email 컬럼에 인덱스가 없어서 10만 건을 매번 Full Table Scan하고 있는 건데, 그 위에 Redis를 올리겠다는 거다.

(이 사례는 Ch.14에서 본격적으로 다룬다. "인덱스를 안 걸어놓고 Redis를 설치했습니다"가 바로 이 이야기다.)


### 주니어 B의 프롬프트 (키워드 있음)

```
SQLAlchemy로 User 테이블에서 email로 조회하는 API가 느리다.
EXPLAIN 돌려보니 Full Table Scan이 나온다.
email 컬럼에 B-Tree 인덱스를 추가하는 migration 코드를 만들어줘.
```

AI의 응답 (요약):

```python
# Alembic migration
def upgrade():
    op.create_index(
        "ix_user_email",
        "user",
        ["email"],
        unique=False,
    )

def downgrade():
    op.drop_index("ix_user_email", table_name="user")
```

인덱스 하나로 2~3초 걸리던 조회가 수 밀리초로 줄어든다. Redis도 필요 없고, 비동기도 필요 없고, Connection Pool 조정도 필요 없다.

### 차이가 뭔가?

A는 "느리다"고만 했다. AI는 "느린 것"에 대한 모든 일반적 해법을 나열했다. B는 "EXPLAIN", "Full Table Scan", "B-Tree 인덱스"라는 키워드로 문제를 정확히 짚었다. AI는 정확히 그 해법만 줬다.

여기서 중요한 건, B가 "EXPLAIN을 돌려봤다"는 점이다. EXPLAIN이라는 키워드를 알아야 원인을 진단할 수 있고, 진단 결과를 프롬프트에 넣어야 AI가 정확한 답을 준다.


## 7-3. 사례 C: 테스트 코드를 짜줘

### 상황

주문 API가 있다. 주문을 생성하면 DB에 저장하고, 재고를 차감한다. 이 API에 대한 테스트를 작성하고 싶다.

```python
@app.post("/orders")
def create_order(item_id: int, quantity: int):
    item = db.query(Item).get(item_id)
    if item.stock < quantity:
        raise HTTPException(400, "재고 부족")
    item.stock -= quantity
    order = Order(item_id=item_id, quantity=quantity)
    db.add(order)
    db.commit()
    return {"order_id": order.id}
```


### 주니어 A의 프롬프트 (키워드 없음)

```
주문 API에 대한 테스트 코드를 작성해줘.
```

AI의 응답 (요약):

```python
def test_create_order():
    # DB를 Mock으로 대체
    mock_db = MagicMock()
    mock_item = MagicMock()
    mock_item.stock = 100

    mock_db.query.return_value.get.return_value = mock_item

    response = create_order(item_id=1, quantity=5)

    assert response["order_id"] is not None
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
```

Mock 투성이다. `mock_item.stock = 100`이라고 직접 넣어줬으니 "재고 부족" 분기가 동작하는지 아닌지 알 수 없다. `mock_db.commit.assert_called_once()`는 "commit이 호출됐는가"만 확인한다. 실제로 DB에 데이터가 들어갔는지는 모른다.

이 테스트는 통과한다. 그런데 운영에서 "commit 후에 order.id가 None이다"라는 버그가 터지면? 이 Mock 테스트는 그걸 잡을 수 없다.

(이 사례는 Ch.21에서 본격적으로 다룬다. "테스트를 짜라고 했더니 전부 Mocking입니다"가 바로 이 이야기다.)


### 주니어 B의 프롬프트 (키워드 있음)

```
주문 API의 Integration Test를 짜줘.
- TestClient + 테스트용 SQLite (in-memory) DB를 써서 실제 DB 연동 포함
- 정상 주문 + 재고 부족 케이스 둘 다 커버
- Mock은 외부 API 호출에만 쓰고, DB는 실제로 읽고 써라
```

AI의 응답 (요약):

```python
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 테스트용 in-memory DB
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client():
    Base.metadata.create_all(engine)
    # 핵심: app의 DB 의존성을 테스트용 DB로 교체
    app.dependency_overrides[get_db] = override_get_db

    # DB에 테스트 데이터 실제로 넣기
    session = TestSession()
    item = Item(id=1, name="테스트 상품", stock=10)
    session.add(item)
    session.commit()
    session.close()

    yield TestClient(app)

    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)

def test_create_order_success(client):
    response = client.post("/orders", json={"item_id": 1, "quantity": 3})
    assert response.status_code == 200

    # 실제 DB에서 재고 확인
    session = TestSession()
    item = session.get(Item, 1)  # SQLAlchemy 2.0 방식
    assert item.stock == 7  # 10 - 3
    session.close()

def test_create_order_insufficient_stock(client):
    response = client.post("/orders", json={"item_id": 1, "quantity": 999})
    assert response.status_code == 400
```

(이 코드는 개념을 보여주기 위한 의사 코드다. `import`, 모델 정의 등이 생략돼 있다. 실제 동작하는 Integration Test 코드는 Ch.21에서 다룬다.)

실제 DB(in-memory SQLite)에 데이터를 넣고, API를 호출하고, DB에서 결과를 확인한다. Mock이 없다. 재고가 정말 차감됐는지, 재고 부족 시 정말 에러가 나는지를 실제 동작으로 검증한다.

### 차이가 뭔가?

A는 "테스트 짜줘"라고만 했다. AI는 가장 쉬운 방법인 Mock으로 채웠다. B는 "Integration Test", "in-memory DB", "Mock은 외부 API에만"이라는 키워드로 테스트의 범위와 방식을 지정했다.

B가 처음부터 Integration Test를 다 아는 건 아니었을 수 있다. 하지만 "Unit Test와 Integration Test의 차이"라는 CS(소프트웨어 공학) 키워드를 알고 있었기 때문에, AI에게 정확한 방향을 제시할 수 있었다.


## 7-4. 세 사례의 공통점

<!-- 기대 키워드: Prompt Engineering, LLM, Token, Context Window -->

세 사례를 정리하면 패턴이 보인다.

| | 주니어 A (키워드 없음) | 주니어 B (키워드 있음) |
|--|----------------------|---------------------|
| 사례 A | "크기를 줄여줘" | "bit packing으로 합쳐줘" |
| 사례 B | "성능 최적화해줘" | "Full Table Scan이니까 인덱스 걸어줘" |
| 사례 C | "테스트 짜줘" | "Integration Test, DB는 실제로" |
| 결과 | 범용적이지만 핵심을 놓침 | 정확하게 원하는 결과 |

A의 프롬프트는 "문제 현상"을 말했다. B의 프롬프트는 "문제 원인 + 해결 방향"을 말했다. 그리고 그 차이를 만든 건 CS 키워드다.

그런데 여기서 한 가지 의문이 생긴다.

"왜 AI는 A한테 더 좋은 답을 못 주는 거지? AI가 알아서 원인을 파악하면 안 되는 건가?"

이걸 이해하려면 AI 코딩 도구가 어떻게 작동하는지를 알아야 한다.

---

[< 환경 세팅](./README.md) | [AI 코딩 도구의 작동 원리 >](./02-how-ai-coding-works.md)
