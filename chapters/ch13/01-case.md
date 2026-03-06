# Ch.13 사례: ORM이 만든 쿼리 수백 개

[< 환경 세팅](./README.md) | [ORM과 SQL >](./02-orm-sql.md)

---

Ch.12에서 트리와 그래프, 그리고 재귀의 비용을 확인했다. Part 3의 자료구조 이야기가 끝났고, 이제 Part 4: 데이터베이스를 깊게 파고든다. 첫 번째 주제는 ORM이 만들어내는 SQL이다.


## 13-1. 사례: 주문 목록 API가 느리다

2년차 백엔드 개발자가 주문 내역 조회 API를 만들었다. 유저 목록을 가져오고, 각 유저의 주문 내역을 보여주는 간단한 API다. SQLAlchemy ORM으로 모델을 정의하고, 관계를 설정했다.

```python
# 모델 정의 (SQLAlchemy ORM)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product = Column(String(100))
    amount = Column(Integer)
    user = relationship("User", back_populates="orders")
```

API 코드도 간단하다:

```python
@router.get("/users-orders")
def get_users_with_orders():
    with Session(engine) as session:
        users = session.query(User).all()
        result = []
        for user in users:
            result.append({
                "name": user.name,
                "orders": [
                    {"product": o.product, "amount": o.amount}
                    for o in user.orders  # <-- 여기가 문제
                ]
            })
        return result
```

개발 환경에서는 잘 돌아간다. 유저 5명, 주문 10건. 응답 시간 20ms. 아무 문제 없다.

운영에 올렸다. 유저 1,000명, 주문 50,000건. API 응답 시간이 3초를 넘긴다. 서버 로그를 켰다.

```
SELECT users.id, users.name FROM users
SELECT orders.id, orders.user_id, orders.product, orders.amount FROM orders WHERE orders.user_id = 1
SELECT orders.id, orders.user_id, orders.product, orders.amount FROM orders WHERE orders.user_id = 2
SELECT orders.id, orders.user_id, orders.product, orders.amount FROM orders WHERE orders.user_id = 3
...
SELECT orders.id, orders.user_id, orders.product, orders.amount FROM orders WHERE orders.user_id = 1000
```

쿼리가 1,001개. 유저를 가져오는 쿼리 1개 + 각 유저의 주문을 가져오는 쿼리 1,000개. 이게 N+1 Problem이다.

<details>
<summary>N+1 Problem</summary>

ORM에서 연관 데이터를 조회할 때 발생하는 대표적인 성능 문제다. 메인 엔티티를 가져오는 쿼리 1개(이게 "+1")와 각 엔티티의 연관 데이터를 가져오는 쿼리 N개가 실행된다. N이 10이면 11개, N이 1,000이면 1,001개의 쿼리가 날아간다.

왜 이렇게 되는가? ORM의 기본 전략이 Lazy Loading이기 때문이다. "연관 데이터는 실제로 접근할 때 가져온다"는 전략이다. `user.orders`에 접근하는 순간에 비로소 `SELECT ... FROM orders WHERE user_id = ?`가 실행된다. 유저가 1,000명이면 이 쿼리가 1,000번 실행된다.

Java의 JPA/Hibernate, Python의 SQLAlchemy, Django ORM, Node.js의 Prisma/TypeORM 전부 같은 문제를 가지고 있다. (Go의 GORM도 마찬가지다.)

Ch.8에서 프롬프트 키워드로 잠깐 언급했던 그 N+1이다. 이번에 본격적으로 파고든다.

</details>


## 13-2. 결과 예측

질문을 던져보겠다.

- "유저 1,000명의 주문을 가져올 때, 쿼리 1,001개 방식과 쿼리 2개 방식의 응답 시간 차이가 얼마나 날 것 같은가?"
- "쿼리 수가 1,001개에서 2개로 줄면, 500배 빨라지는가?"

<!-- 기대 키워드: N+1 Problem, Lazy Loading, Eager Loading, JOIN, Connection Pool, Full Table Scan -->

힌트를 하나 주겠다. 쿼리 수만 줄어드는 게 아니다. 각 쿼리마다 DB와 주고받는 네트워크 왕복(Round Trip)이 있다. Ch.6에서 TCP Connection이 왜 비싼지 봤다. 쿼리 1,001개는 네트워크 왕복도 1,001번이다.


## 13-3. 결과 분석

### Lazy Loading (N+1) vs Eager Loading (JOIN)

유저 100명, 각 유저당 주문 5건 (총 500건)으로 테스트했다. 동일한 데이터를 두 가지 방식으로 조회했다.

| 방식 | 쿼리 수 | 평균 응답 시간 | 배율 |
|------|---------|---------------|------|
| Lazy Loading (N+1) | 101 | 48ms | 1x (기준) |
| Eager Loading (joinedload) | 1 | 6ms | 8x 빠름 |
| Eager Loading (subqueryload) | 2 | 8ms | 6x 빠름 |

측정 환경: M1 Mac, Python 3.12, SQLAlchemy 2.0, MySQL 8.0 (Docker), 유저 100명 x 주문 5건

유저 100명에서 이미 8배 차이가 난다. 유저 1,000명이면?

| 방식 | 쿼리 수 | 평균 응답 시간 | 배율 |
|------|---------|---------------|------|
| Lazy Loading (N+1) | 1,001 | 520ms | 1x (기준) |
| Eager Loading (joinedload) | 1 | 35ms | 15x 빠름 |
| Eager Loading (subqueryload) | 2 | 42ms | 12x 빠름 |

측정 환경: M1 Mac, Python 3.12, SQLAlchemy 2.0, MySQL 8.0 (Docker), 유저 1,000명 x 주문 5건

N이 커질수록 차이가 벌어진다. 100명에서 8배 차이이던 것이 1,000명에서 15배로 벌어졌다. N+1의 비용은 N에 비례하니까 당연하다.

(localhost에서 이 정도다. DB가 별도 서버에 있어서 네트워크 지연이 1ms만 추가돼도, 1,001번의 왕복에서 1초가 추가된다.)

왜 500배가 아니라 15배인가? 쿼리 수는 1,001개에서 1개로 줄었지만, 쿼리 하나의 실행 시간은 줄어들지 않는다. JOIN으로 한 번에 가져오는 쿼리는 데이터 양이 더 크다. 다만 네트워크 왕복 횟수가 극적으로 줄어들기 때문에 전체 시간은 크게 줄어든다.

정리하면: N+1의 진짜 비용은 "쿼리가 많다"가 아니라 "네트워크 왕복이 많다"이다.


## 13-4. 코드 설명

### Lazy Loading (N+1 발생)

```python
@router.get("/orm/lazy")
def get_users_lazy():
    """N+1 Problem 발생 - Lazy Loading"""
    with Session(engine) as session:
        users = session.query(User).all()  # 쿼리 1: SELECT * FROM users
        result = []
        for user in users:
            # user.orders에 접근하는 순간마다 쿼리 발생
            # 쿼리 2~N+1: SELECT * FROM orders WHERE user_id = ?
            result.append({
                "name": user.name,
                "order_count": len(user.orders),
            })
        return result
```

`session.query(User).all()`은 유저만 가져온다. `user.orders`에 접근하는 순간, SQLAlchemy가 "아, 이 유저의 주문이 필요하구나"라고 판단하고 쿼리를 날린다. 유저가 N명이면 이 쿼리가 N번 추가 실행된다.

왜 ORM이 이렇게 동작하는가? 기본 전략이 Lazy Loading이기 때문이다.

<details>
<summary>Lazy Loading (지연 로딩)</summary>

연관 데이터를 "실제로 접근할 때" 가져오는 전략이다. `user.orders`를 코드에서 참조하는 순간에 DB 쿼리가 실행된다. 메모리를 아끼려는 의도다. 주문 데이터가 필요 없는 경우까지 미리 가져올 필요는 없으니까.

문제는 "루프 안에서 접근하면 N번 쿼리가 날아간다"는 거다. 단건 조회에서는 합리적인 전략이 루프에서는 성능 재앙이 된다.

Java의 JPA에서는 `FetchType.LAZY`가 기본이고, Python의 SQLAlchemy에서도 relationship의 기본 로딩이 Lazy다.

</details>

### Eager Loading (joinedload)

```python
from sqlalchemy.orm import joinedload

@router.get("/orm/eager-join")
def get_users_eager_join():
    """Eager Loading - JOIN으로 한 번에 가져온다"""
    with Session(engine) as session:
        # 쿼리 1개: SELECT users.*, orders.* FROM users LEFT JOIN orders ON ...
        users = session.query(User).options(joinedload(User.orders)).all()
        result = []
        for user in users:
            # user.orders가 이미 로딩되어 있다. 추가 쿼리 없음.
            result.append({
                "name": user.name,
                "order_count": len(user.orders),
            })
        return result
```

`joinedload(User.orders)`를 붙이면, SQLAlchemy가 `LEFT OUTER JOIN`으로 유저와 주문을 한 번에 가져온다. 실행되는 SQL은:

```sql
SELECT users.id, users.name, orders.id, orders.user_id, orders.product, orders.amount
FROM users
LEFT OUTER JOIN orders ON users.id = orders.user_id
```

쿼리 1개. 네트워크 왕복 1번. `user.orders`에 접근해도 추가 쿼리가 발생하지 않는다. 데이터가 이미 메모리에 있으니까.

<details>
<summary>Eager Loading (즉시 로딩)</summary>

연관 데이터를 "메인 쿼리와 함께" 미리 가져오는 전략이다. Lazy Loading의 반대다. 두 가지 방식이 있다:

1. joinedload: SQL JOIN으로 한 번에 가져온다. 쿼리 1개. 데이터가 많으면 결과 행(row)이 커질 수 있다.
2. subqueryload: 메인 쿼리 후 서브쿼리로 연관 데이터를 한 번에 가져온다. 쿼리 2개.

Java의 JPA에서는 `@EntityGraph`나 JPQL의 `JOIN FETCH`로, Django ORM에서는 `select_related()` / `prefetch_related()`로 같은 걸 한다.

</details>

### Eager Loading (subqueryload)

```python
from sqlalchemy.orm import subqueryload

@router.get("/orm/eager-subquery")
def get_users_eager_subquery():
    """Eager Loading - 서브쿼리로 가져온다"""
    with Session(engine) as session:
        # 쿼리 2개:
        #   1. SELECT * FROM users
        #   2. SELECT * FROM orders WHERE user_id IN (SELECT id FROM users)
        users = session.query(User).options(subqueryload(User.orders)).all()
        result = []
        for user in users:
            result.append({
                "name": user.name,
                "order_count": len(user.orders),
            })
        return result
```

subqueryload는 쿼리를 2개로 나눈다:

```sql
-- 쿼리 1
SELECT users.id, users.name FROM users

-- 쿼리 2
SELECT orders.id, orders.user_id, orders.product, orders.amount
FROM orders
WHERE orders.user_id IN (SELECT users.id FROM users)
```

joinedload와 차이가 뭔가? joinedload는 JOIN이니까 유저-주문 조합마다 행이 생긴다. 주문이 5개인 유저는 5행이 된다. 데이터가 많아지면 결과 집합이 커진다. subqueryload는 유저 테이블과 주문 테이블을 따로 가져오니까 중복 행이 없다. 대신 쿼리가 2개다.

어떤 걸 써야 하는가? 연관 데이터가 적으면 joinedload, 많으면 subqueryload가 유리하다. 정답은 없고, EXPLAIN으로 확인하는 게 맞다. (EXPLAIN은 다음 파일에서 다룬다.)

joinedload와 subqueryload 중 어떤 것을 써야 하는지보다 중요한 건, Lazy Loading 상태에서 루프를 돌리면 N+1이 발생한다는 사실을 아는 것이다. 이걸 모르면 운영에서 쿼리 수천 개가 날아가는 걸 보고 나서야 원인을 찾게 된다.

그런데 한 가지 더 의문이 있다. "쿼리 수가 줄어든 건 알겠는데, 그 쿼리가 실제로 효율적으로 실행되는지는 어떻게 확인하는가?" 다음에서 ORM이 생성하는 SQL을 확인하는 방법과, 그 SQL이 효율적인지 판단하는 도구(EXPLAIN)를 본다.

---

[< 환경 세팅](./README.md) | [ORM과 SQL >](./02-orm-sql.md)
