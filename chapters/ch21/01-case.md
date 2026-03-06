# Ch.21 사례: Mock으로만 통과한 테스트

[< 환경 세팅](./README.md) | [테스트 전략과 경계 >](./02-test-strategy.md)

---

Ch.20에서 God Class를 분해하고 의존성을 분리했다. 코드 구조가 좋아졌으니, 이제 테스트를 짜야 한다. 그런데 테스트를 "잘" 짜야 한다는 게 오늘의 핵심이다.


## 21-1. 사례 설명

2년차 백엔드 개발자가 주문 서비스를 만들고 있다. Ch.20에서 배운 대로 코드를 분리했다. Controller, Service, Repository, 외부 결제 API 클라이언트까지 깔끔하게 나눴다.

코드를 다 짰으니 테스트를 작성한다. 팀 리더가 "coverage 80% 이상"이라고 했으니까, 열심히 짠다. DB 접근은 Mock으로 대체하고, 외부 결제 API도 Mock으로 대체하고, 심지어 Service 레이어까지 Mock으로 대체해서 Controller를 테스트한다.

```python
# 주문 서비스 - 핵심 로직
class OrderService:
    def __init__(self, order_repo, payment_client, inventory_repo):
        self.order_repo = order_repo
        self.payment_client = payment_client
        self.inventory_repo = inventory_repo

    def create_order(self, user_id: int, product_id: int, quantity: int):
        # 1. 재고 확인
        product = self.inventory_repo.get_product(product_id)
        if product.stock < quantity:
            raise ValueError("재고 부족")

        # 2. 결제 요청
        payment_result = self.payment_client.charge(
            user_id=user_id,
            amount=product.price * quantity
        )

        # 3. 주문 생성
        order = self.order_repo.create(
            user_id=user_id,
            product_id=product_id,
            quantity=quantity,
            payment_id=payment_result["payment_id"]
        )

        # 4. 재고 차감
        self.inventory_repo.decrease_stock(product_id, quantity)

        return order
```

이 코드에 대해 개발자가 작성한 테스트:

```python
from unittest.mock import MagicMock, patch

def test_create_order_success():
    # 전부 Mock으로 대체
    mock_order_repo = MagicMock()
    mock_payment_client = MagicMock()
    mock_inventory_repo = MagicMock()

    # Mock이 반환할 값을 지정
    mock_product = MagicMock()
    mock_product.stock = 100
    mock_product.price = 10000
    mock_inventory_repo.get_product.return_value = mock_product

    mock_payment_client.charge.return_value = {"payment_id": "pay_123"}
    mock_order_repo.create.return_value = {"order_id": 1, "status": "completed"}

    service = OrderService(mock_order_repo, mock_payment_client, mock_inventory_repo)
    result = service.create_order(user_id=1, product_id=1, quantity=2)

    # 검증: 주문이 생성됐는가?
    assert result["order_id"] == 1
    mock_payment_client.charge.assert_called_once()
    mock_order_repo.create.assert_called_once()
    mock_inventory_repo.decrease_stock.assert_called_once_with(1, 2)


def test_create_order_insufficient_stock():
    mock_inventory_repo = MagicMock()
    mock_product = MagicMock()
    mock_product.stock = 0  # 재고 없음
    mock_inventory_repo.get_product.return_value = mock_product

    service = OrderService(MagicMock(), MagicMock(), mock_inventory_repo)

    try:
        service.create_order(user_id=1, product_id=1, quantity=2)
        assert False, "예외가 발생해야 한다"
    except ValueError as e:
        assert "재고 부족" in str(e)
```

pytest를 돌린다. 전부 통과. coverage 92%. 팀 리더에게 보고한다. "테스트 다 짰습니다."

배포 당일. 첫 번째 주문 요청이 들어온다.

결과: 500 에러. 서비스 장애.

원인이 두 가지 있었다:

1. 결제 API의 응답 형식이 바뀌었다. `{"payment_id": "pay_123"}`이 아니라 `{"data": {"id": "pay_123", "status": "approved"}}`로 바뀌어 있었다. Mock은 예전 형식을 반환하고 있었으니 테스트는 당연히 통과했다.

2. DB 쿼리에 오류가 있었다. `order_repo.create()`에서 `payment_id` 컬럼이 실제 DB 스키마와 달랐다. DB에는 `payment_ref_id`라는 이름이었다. Mock은 DB를 건드리지 않으니까 이런 건 잡지 못한다.

"테스트가 있었는데 왜 장애가 났는가?"

Mock이 실제 의존성의 동작을 보장해주지 않기 때문이다. Mock은 "이렇게 호출되면 이걸 반환해"라는 대본에 불과하다. 대본과 현실이 달라지면, 테스트는 통과하지만 실제로는 깨진다.


## 21-2. 결과 예측

여기서 질문을 던져본다.

- "이 테스트에서 Mock을 전부 제거하고 실제 DB와 실제 API를 연결하면, 몇 개의 테스트가 깨지는가?"
- "깨지는 테스트가 많을수록, 그 테스트는 뭘 검증하고 있었던 건가?"
- "Mock을 써야 하는 곳과 쓰면 안 되는 곳의 기준은 뭔가?"

<!-- 기대 키워드: Unit Test, Integration Test, Mock, Stub, Test Double, Test Pyramid -->


## 21-3. 결과 분석

위 사례를 분석해보자. Mock을 제거하면 무슨 일이 벌어지는가?

| 테스트 항목 | Mock 사용 시 | Mock 제거 시 | 원인 |
|------------|-------------|-------------|------|
| 재고 확인 로직 | 통과 | 통과 | 순수 비교 로직이라 Mock과 무관 |
| 결제 API 호출 | 통과 | 실패 | 실제 API 응답 형식이 다름 |
| DB 주문 생성 | 통과 | 실패 | 컬럼명이 실제 스키마와 다름 |
| 재고 차감 | 통과 | 통과 (단, 동시성 미검증) | 단일 요청은 동작하지만 Ch.5에서 본 Race Condition은 못 잡음 |

4개 테스트 중 2개가 깨진다. 깨진 2개는 "외부 의존성과의 연동"을 검증해야 하는 테스트였다. Mock이 이 연동을 가로막고 있었다.

coverage 92%는 "코드의 92%를 실행했다"는 뜻이지, "코드의 92%가 정상 동작한다"는 뜻이 아니다.

이 에피소드에서 중요한 건 두 가지다.

첫째, Mock은 "외부 의존성을 격리하는 도구"이지 "모든 의존성을 격리하는 도구"가 아니다. DB 쿼리 로직이 제대로 동작하는지 확인하려면 실제 DB가 필요하다.

둘째, "테스트가 있다"와 "검증이 됐다"는 다른 말이다. 테스트가 100개 있어도, 전부 Mock으로 돌아가면 실제 동작은 한 번도 확인한 적이 없는 거다.

<details>
<summary>Unit Test (단위 테스트)</summary>

함수나 메서드 하나를 격리해서 테스트하는 것이다. 외부 의존성(DB, API, 파일 시스템)을 Mock이나 Stub으로 대체해서, 오직 해당 함수의 로직만 검증한다. 실행이 빠르고 원인 파악이 쉬운 게 장점이다. 하지만 "함수 안의 로직"만 검증하므로, 함수 간 연동이나 외부 시스템과의 호환성은 확인하지 못한다.
(Java에서는 JUnit + Mockito, Go에서는 `testing` 패키지로 작성한다.)

</details>

<details>
<summary>Integration Test (통합 테스트)</summary>

여러 모듈이나 시스템이 함께 동작하는 것을 검증하는 테스트다. "내 코드 + 실제 DB"를 연결해서 쿼리가 제대로 동작하는지, 트랜잭션이 제대로 커밋/롤백되는지 확인한다. Unit Test보다 느리지만, Mock이 가려버린 실제 동작 문제를 잡을 수 있다. 위 사례에서 컬럼명 불일치는 Integration Test가 있었다면 배포 전에 잡혔을 거다.
(Java Spring에서는 `@DataJpaTest`, `@SpringBootTest` 등으로 지원한다.)

</details>

<details>
<summary>Mock (모의 객체)</summary>

테스트에서 실제 객체를 대체하는 가짜 객체의 한 종류다. 미리 정해진 응답을 반환하면서, 동시에 "어떻게 호출됐는가"를 기록한다. `assert_called_once()`, `assert_called_with()` 같은 메서드로 호출 여부와 인자를 검증할 수 있다. Mock의 핵심은 "행위 검증"이다. "이 함수가 호출됐는가?"를 확인하는 거지, "이 함수의 결과가 맞는가?"를 확인하는 게 아니다.

</details>


## 21-4. 코드 설명

문제를 좀 더 구체적으로 보자.

### Mock으로만 통과하는 테스트의 구조

```python
def test_create_order_with_all_mocks():
    # 1. 모든 의존성을 Mock으로 대체
    mock_order_repo = MagicMock()
    mock_payment_client = MagicMock()
    mock_inventory_repo = MagicMock()

    # 2. Mock이 반환할 "대본"을 작성
    mock_product = MagicMock()
    mock_product.stock = 100
    mock_product.price = 10000
    mock_inventory_repo.get_product.return_value = mock_product

    # 3. 결제 API의 응답을 "내가 정한 값"으로 고정
    mock_payment_client.charge.return_value = {"payment_id": "pay_123"}

    # 4. 테스트 실행
    service = OrderService(mock_order_repo, mock_payment_client, mock_inventory_repo)
    result = service.create_order(user_id=1, product_id=1, quantity=2)

    # 5. 검증: Mock이 "호출됐는가?"만 확인
    mock_payment_client.charge.assert_called_once()
```

이 테스트가 실제로 검증하는 건 뭔가?

"OrderService.create_order()가 내부적으로 payment_client.charge()를 호출한다."

그게 전부다. charge()가 실제로 무엇을 반환하는지, 그 반환값을 create_order()가 제대로 처리하는지는 검증하지 않는다. `{"payment_id": "pay_123"}`라는 대본이 현실과 다르면, 테스트는 통과하지만 운영에서 터진다.

### Mock을 줄인 Integration Test

같은 로직을 실제 DB와 연결해서 테스트하면 이렇게 된다:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 테스트용 SQLite DB (실제 DB와 같은 스키마)
TEST_DB_URL = "sqlite:///./test_orders.db"

@pytest.fixture
def db_session():
    """테스트용 DB 세션을 만들고, 테스트 후 롤백한다."""
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(engine)  # 테이블 생성
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()  # 테스트 데이터 정리
    session.close()

@pytest.fixture
def seed_product(db_session):
    """테스트용 상품 데이터를 넣는다."""
    product = Product(id=1, name="테스트 상품", price=10000, stock=100)
    db_session.add(product)
    db_session.commit()
    return product

def test_create_order_with_real_db(db_session, seed_product):
    # 실제 DB를 쓰는 Repository
    order_repo = OrderRepository(db_session)
    inventory_repo = InventoryRepository(db_session)

    # 결제 API만 Mock (외부 서비스니까)
    mock_payment = MagicMock()
    mock_payment.charge.return_value = {
        "data": {"id": "pay_456", "status": "approved"}
    }

    service = OrderService(order_repo, mock_payment, inventory_repo)
    result = service.create_order(user_id=1, product_id=1, quantity=2)

    # 검증: DB에 실제로 데이터가 들어갔는가?
    saved_order = db_session.query(Order).filter_by(id=result["order_id"]).first()
    assert saved_order is not None
    assert saved_order.quantity == 2

    # 검증: 재고가 실제로 차감됐는가?
    updated_product = db_session.query(Product).filter_by(id=1).first()
    assert updated_product.stock == 98
```

차이가 보이는가?

첫 번째 테스트(Mock만)는 "charge가 호출됐는가?"를 확인한다. 두 번째 테스트(Integration)는 "DB에 주문이 저장됐는가?", "재고가 실제로 줄었는가?"를 확인한다.

두 번째 테스트에서도 결제 API는 Mock이다. 이건 맞다. 결제 API는 외부 서비스다. 테스트할 때마다 실제 결제를 하면 돈이 빠져나간다. 외부 서비스의 Mock은 정당하다.

하지만 DB는 다르다. DB는 "내 시스템의 일부"다. 쿼리가 제대로 동작하는지, 스키마와 맞는지, 트랜잭션이 제대로 커밋되는지는 실제 DB로 확인해야 한다. Ch.13에서 다뤘던 N+1 Problem도 Mock으로는 절대 잡을 수 없다. 실제 DB에서 쿼리 로그를 봐야 발견된다.

(pytest의 fixture는 테스트 데이터를 setup/teardown하는 함수다. `yield` 위쪽이 setup, 아래쪽이 teardown이다. `db_session` fixture가 테스트마다 세션을 만들고, 테스트 후 rollback으로 정리한다. 이러면 테스트 간 데이터가 오염되지 않는다.)

정리하면:

| 구분 | Mock 테스트 | Integration Test |
|------|-----------|-----------------|
| 속도 | 빠르다 (ms 단위) | 느리다 (DB 연결, 수십~수백ms) |
| 검증 범위 | 로직 흐름만 | 로직 + DB 연동 + 스키마 |
| 외부 API | Mock (적절) | Mock (적절) |
| DB | Mock (위험) | 실제 DB (안전) |
| 버그 발견 | 로직 버그만 | 연동 버그까지 |

Mock 테스트가 나쁜 건 아니다. 문제는 "Mock만 있을 때"다. Unit Test(Mock)와 Integration Test(실제 DB)를 같이 갖추는 게 핵심이다.

그러면 Unit Test와 Integration Test를 어떤 비율로 짜야 하는가? Mock을 써야 하는 곳과 쓰면 안 되는 곳의 경계는 어디인가?

다음에서 본다.

---

[< 환경 세팅](./README.md) | [테스트 전략과 경계 >](./02-test-strategy.md)
