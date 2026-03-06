# Ch.20 사례: 3000줄짜리 God Class

[< 환경 세팅](./README.md) | [SOLID와 Clean Architecture >](./02-solid-architecture.md)

---

Part 5에서 성능 최적화를 마쳤다. 쿼리를 고치고, 캐시를 붙이고, Bottleneck을 찾아서 해결하는 방법까지 다뤘다. 이번에는 다른 종류의 문제를 이야기한다. 코드 구조 문제다.


## 20-1. 사례 설명

3년차 백엔드 개발자가 쇼핑몰의 주문 서비스를 담당하고 있다. 처음에는 단순했다. 주문 생성, 결제 처리, 주문 조회. 이 세 가지 기능이 하나의 `OrderService` 클래스에 들어 있었다. 200줄 남짓. 깔끔했다.

1년이 지났다. 기능이 추가됐다.

- 재고 확인/차감
- 결제 수단 분기 (카드, 계좌이체, 간편결제)
- 결제 취소/환불
- 주문 상태 변경 알림 (이메일, SMS, 푸시)
- 쿠폰/포인트 적용
- 주문 이력 로깅
- 배송 상태 조회

전부 `OrderService` 한 파일에 들어갔다. 이제 3,000줄이다.

```python
# order_service.py - 3,000줄짜리 God Class
class OrderService:
    def __init__(self, db, redis_client, email_client, sms_client, push_client, payment_gateway, ...):
        self.db = db
        self.redis = redis_client
        self.email = email_client
        self.sms = sms_client
        self.push = push_client
        self.payment = payment_gateway
        # ... 10개 넘는 의존성

    def create_order(self, user_id, items, coupon_code=None, points=0):
        # 재고 확인 (50줄)
        for item in items:
            stock = self.db.query(...)
            if stock < item.quantity:
                raise OutOfStockError(...)

        # 쿠폰 검증 (30줄)
        if coupon_code:
            coupon = self.db.query(...)
            if coupon.expired:
                raise ExpiredCouponError(...)
            discount = self._calculate_coupon_discount(coupon, items)

        # 포인트 적용 (20줄)
        if points > 0:
            user_points = self.db.query(...)
            if user_points < points:
                raise InsufficientPointsError(...)

        # 결제 처리 (80줄)
        if payment_method == "card":
            result = self.payment.charge_card(...)
        elif payment_method == "bank_transfer":
            result = self.payment.transfer(...)
        elif payment_method == "kakao_pay":
            result = self.payment.kakao_pay(...)
        elif payment_method == "naver_pay":
            result = self.payment.naver_pay(...)
        # ... 결제 수단이 추가될 때마다 elif가 늘어난다

        # 재고 차감 (20줄)
        for item in items:
            self.db.execute(...)

        # 주문 생성 (30줄)
        order = Order(...)
        self.db.add(order)
        self.db.commit()

        # 알림 발송 (40줄)
        try:
            self.email.send(user.email, "주문 완료", ...)
        except:
            pass  # 이메일 실패해도 주문은 성공
        try:
            self.sms.send(user.phone, "주문 완료", ...)
        except:
            pass
        try:
            self.push.send(user.device_token, "주문 완료", ...)
        except:
            pass

        # 로깅 (20줄)
        self.db.add(OrderLog(action="created", ...))
        self.db.commit()

        # 캐시 갱신 (10줄)
        self.redis.delete(f"user:{user_id}:orders")

        return order

    def cancel_order(self, order_id):
        # 200줄짜리 취소 로직
        # 결제 취소, 재고 복구, 쿠폰 반환, 포인트 환급, 알림, 로깅...
        ...

    def _calculate_coupon_discount(self, coupon, items):
        # 50줄짜리 할인 계산
        ...

    def get_order_status(self, order_id):
        # 30줄
        ...

    def update_shipping_status(self, order_id, status):
        # 40줄 + 알림 발송 코드 중복
        ...

    # ... 메서드 30개 이상
```

이 코드의 문제가 뭔가?

"잘 돌아가는데?" 맞다. 지금은 잘 돌아간다. 문제는 기능을 추가하거나 수정할 때 발생한다.

<details>
<summary>God Class (갓 클래스)</summary>

너무 많은 책임을 가진 거대 클래스를 말한다. "신(God)처럼 모든 것을 다 한다"는 의미에서 붙은 이름이다. 처음에는 편리하지만, 코드가 커질수록 수정이 어려워지고, 한 곳을 고치면 다른 곳이 깨지는 현상이 반복된다. 소프트웨어 공학에서 대표적인 안티 패턴이다.
(Java에서는 Spring의 Service 클래스가, Python에서는 Django의 views.py나 FastAPI의 라우터 파일이 God Class가 되기 쉽다.)

</details>


## 20-2. 결과 예측

여러분에게 질문을 던진다.

- "이 코드에 '토스페이' 결제 수단을 추가하려면 어디를 고쳐야 하는가?"
- "결제 취소 로직에 버그가 있으면, 영향 범위가 어디까지인가?"
- "알림 발송 방식을 이메일에서 카카오톡으로 바꾸려면, 몇 군데를 수정해야 하는가?"

<!-- 기대 키워드: SRP, God Class, 관심사의 분리, DI, SOLID -->


## 20-3. 결과 분석

위 질문에 답해보면 문제가 보인다.

### 결제 수단 추가: "토스페이"

`create_order()` 메서드 안의 결제 처리 부분을 찾는다. 3,000줄 중에서 해당 elif 블록을 찾아야 한다. 찾았으면 `elif payment_method == "toss_pay":`를 추가한다.

그런데 끝이 아니다. `cancel_order()`에도 결제 취소 분기가 있다. 거기에도 `elif`를 추가해야 한다. `refund_order()`에도. `get_payment_status()`에도. 결제 수단 하나를 추가하는데 4곳 이상을 고쳐야 한다.

한 곳이라도 빠뜨리면? 토스페이로 결제한 주문을 취소할 때 에러가 난다. 그것도 운영 환경에서.

### 결제 취소 버그의 영향 범위

`cancel_order()` 메서드를 고쳤다. 테스트를 돌리고 싶은데, `OrderService`를 테스트하려면 `__init__`에 있는 10개의 의존성을 전부 준비해야 한다. DB, Redis, 이메일 클라이언트, SMS 클라이언트, 푸시 클라이언트, 결제 게이트웨이... 결제 취소 한 줄 고쳤는데, 이 모든 걸 셋업해야 테스트가 돌아간다.

(Ch.21에서 이 문제를 테스트 관점에서 깊이 파고든다.)

### 알림 방식 변경

알림 발송 코드가 `create_order()`에 40줄, `cancel_order()`에 30줄, `update_shipping_status()`에 35줄. 거의 같은 코드가 3곳에 복사-붙여넣기 되어 있다. 이메일을 카카오톡으로 바꾸려면 3곳을 다 찾아서 고쳐야 한다. 하나 빠뜨리면? 주문 생성 알림은 카카오톡으로 오는데, 배송 알림은 여전히 이메일로 간다.

### God Class의 증상 정리

| 증상 | 이 사례에서의 예 |
|------|----------------|
| 파일이 너무 길다 | 3,000줄, 메서드 30개 이상 |
| 의존성이 너무 많다 | `__init__`에 10개 이상의 매개변수 |
| 같은 코드가 여러 곳에 있다 | 알림 발송 코드 3곳 중복 |
| 한 기능을 고치면 다른 기능이 깨진다 | 결제 수단 추가 시 취소/환불도 수정 필요 |
| 테스트를 짜기 어렵다 | 결제 하나 테스트하는데 모든 의존성 필요 |
| 새 기능 추가 시 if/elif가 늘어난다 | 결제 수단마다 분기문 추가 |

이 모든 증상의 근본 원인: 하나의 클래스가 너무 많은 일을 한다.

주문 생성, 결제 처리, 재고 관리, 알림 발송, 쿠폰/포인트, 로깅, 캐시 관리. 이 7가지 책임이 한 클래스에 들어 있다. 하나를 고치면 나머지 6개에 영향을 줄 수 있다. 이걸 소프트웨어 공학에서는 "관심사가 분리되지 않았다"고 말한다.

<details>
<summary>관심사의 분리 (Separation of Concerns)</summary>

프로그램을 서로 다른 관심사(concern)별로 나누는 설계 원칙이다. "결제"와 "알림"은 서로 다른 관심사다. 각각을 독립적인 모듈로 분리하면, 결제 로직을 수정할 때 알림 코드를 건드릴 필요가 없다. 1974년 Edsger Dijkstra가 "On the role of scientific thought"에서 처음 제시한 개념이다.
(Java의 Spring에서는 @Service, @Repository, @Component로 관심사를 분리한다. Python에서는 모듈이나 클래스 단위로 분리한다.)

</details>


## 20-4. 코드 설명

God Class를 관심사별로 분리한 코드를 보자.

### 분리 전: 한 파일에 모든 것

```python
# order_service.py (3,000줄)
class OrderService:
    def create_order(self, ...):
        # 재고 확인 + 쿠폰 검증 + 포인트 적용 + 결제 + 재고 차감 +
        # 주문 생성 + 알림 + 로깅 + 캐시 갱신
        ...
```

### 분리 후: 관심사별로 나눔

```python
# inventory_service.py
class InventoryService:
    """재고 관련 로직만 담당"""
    def check_stock(self, item_id: int, quantity: int) -> bool:
        product = self.db.query(Product).filter(Product.id == item_id).first()
        return product.stock >= quantity

    def deduct_stock(self, item_id: int, quantity: int) -> None:
        product = self.db.query(Product).filter(Product.id == item_id).first()
        if product.stock < quantity:
            raise OutOfStockError(item_id)
        product.stock -= quantity
```

```python
# payment_service.py
class PaymentService:
    """결제 관련 로직만 담당"""
    def __init__(self, payment_gateway):
        self.gateway = payment_gateway

    def charge(self, method: str, amount: int) -> PaymentResult:
        handler = self._get_handler(method)
        return handler.charge(amount)

    def refund(self, payment_id: str) -> RefundResult:
        payment = self.db.query(Payment).filter(Payment.id == payment_id).first()
        handler = self._get_handler(payment.method)
        return handler.refund(payment_id)

    def _get_handler(self, method: str):
        handlers = {
            "card": self.gateway.card,
            "bank_transfer": self.gateway.bank,
            "kakao_pay": self.gateway.kakao,
            "toss_pay": self.gateway.toss,  # 여기에 한 줄만 추가하면 된다
        }
        handler = handlers.get(method)
        if not handler:
            raise UnsupportedPaymentError(method)
        return handler
```

```python
# notification_service.py
class NotificationService:
    """알림 관련 로직만 담당"""
    def __init__(self, email_client, sms_client, push_client):
        self.email = email_client
        self.sms = sms_client
        self.push = push_client

    def notify_order_created(self, user, order):
        self._send_all(user, "주문 완료", f"주문번호 {order.id}")

    def notify_order_cancelled(self, user, order):
        self._send_all(user, "주문 취소", f"주문번호 {order.id}")

    def _send_all(self, user, title, message):
        # 알림 로직이 한 곳에만 있다.
        # 이메일을 카카오톡으로 바꾸려면 여기만 고치면 된다.
        for sender in [self.email, self.sms, self.push]:
            try:
                sender.send(user, title, message)
            except Exception:
                pass  # 알림 실패가 비즈니스 로직을 막으면 안 된다
```

```python
# order_service.py (분리 후, 100줄 이내)
class OrderService:
    """주문 흐름 조율만 담당"""
    def __init__(
        self,
        inventory: InventoryService,
        payment: PaymentService,
        notification: NotificationService,
    ):
        self.inventory = inventory
        self.payment = payment
        self.notification = notification

    def create_order(self, user_id, items, payment_method, coupon_code=None):
        # 1. 재고 확인
        for item in items:
            if not self.inventory.check_stock(item.id, item.quantity):
                raise OutOfStockError(item.id)

        # 2. 결제
        total = sum(item.price * item.quantity for item in items)
        payment_result = self.payment.charge(payment_method, total)

        # 3. 재고 차감
        for item in items:
            self.inventory.deduct_stock(item.id, item.quantity)

        # 4. 주문 생성
        order = self._save_order(user_id, items, payment_result)

        # 5. 알림
        self.notification.notify_order_created(user, order)

        return order
```

### 분리 전후 비교

| 비교 항목 | 분리 전 | 분리 후 |
|-----------|---------|---------|
| OrderService 크기 | 3,000줄 | ~100줄 |
| 결제 수단 추가 | 4곳 이상 수정 | PaymentService 1곳만 |
| 알림 방식 변경 | 3곳 수정 | NotificationService 1곳만 |
| `__init__` 의존성 | 10개 이상 | 3개 (서비스 객체) |
| 테스트 난이도 | 모든 의존성 필요 | 해당 서비스만 테스트 가능 |

분리 후의 `OrderService`가 하는 일을 보면, "흐름을 조율하는 것"뿐이다. 재고 확인은 `InventoryService`에게, 결제는 `PaymentService`에게, 알림은 `NotificationService`에게 위임한다. 자기가 직접 재고를 확인하거나 결제를 처리하지 않는다.

"그런데 파일이 늘어나지 않나? 3,000줄짜리 파일 하나가 300줄짜리 파일 10개가 되면 더 복잡해지는 거 아닌가?"

파일 수는 늘어난다. 하지만 복잡도는 줄어든다. 3,000줄짜리 파일을 전부 이해해야 하는 것과, 내가 수정할 300줄짜리 파일 하나만 이해하면 되는 것. 어느 쪽이 더 쉬운가?

왜 이렇게 분리하면 좋은지, 어떤 원칙에 따라 분리하는지, 다음 파일에서 CS 관점으로 파고든다.

---

[< 환경 세팅](./README.md) | [SOLID와 Clean Architecture >](./02-solid-architecture.md)
