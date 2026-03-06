# Ch.15 사례: 재고가 마이너스가 됐다 - DB 편

[< 환경 세팅](./README.md) | [Isolation Level >](./02-isolation-levels.md)

---

Ch.5에서 Python 변수(`dict`)로 재고를 관리했을 때 Race Condition이 발생하는 걸 확인했다. `threading.Lock()`으로 해결했다. 그런데 실무에서는 재고를 DB에 저장한다. DB로 바꾸면 Race Condition이 사라지는가?

아니다. 무대만 Heap에서 DB로 옮겨졌을 뿐, 같은 문제가 그대로 발생한다.


## 15-1. 사례 설명

한정 수량 이벤트. 상품 재고 10개. 동시에 20명이 구매 버튼을 누른다.

개발자가 작성한 코드의 핵심 로직:

```python
# 1) 재고를 읽는다
product = session.query(Product).filter(Product.id == product_id).first()

# 2) 재고를 체크한다
if product.stock >= quantity:
    # 3) 차감한다
    product.stock -= quantity
    session.commit()
    return "구매 성공"
else:
    return "품절"
```

Ch.5에서 본 "읽기 -> 체크 -> 쓰기" 패턴과 완전히 똑같다. 차이점이라면, 이번에는 Python 변수가 아니라 MySQL 테이블이라는 것뿐이다.

개발 환경에서 테스트했더니 잘 돌아간다. 재고 10개에 15번 요청 보내면 10번 성공, 5번 품절. 완벽하다.

이벤트 당일. 20명이 동시에 구매 버튼을 누른다.

결과: 재고가 -10이 됐다.

"DB에 저장했는데 왜 마이너스가 되지? DB가 알아서 관리해주는 거 아닌가?"


## 15-2. 결과 예측

- "재고 10개, 20명이 동시에 1개씩 구매하면 최종 재고는 얼마인가?"
- "DB Transaction을 쓰면 해결되는가?"
- "Ch.5의 `threading.Lock()`처럼 DB에도 Lock이 있는가?"

<!-- 기대 키워드: Transaction, ACID, Race Condition, SELECT FOR UPDATE, Pessimistic Lock, Optimistic Lock, Isolation Level -->


## 15-3. 결과 분석

k6로 20 VUs가 동시에 각 1건씩 구매 요청을 보냈다. 재고는 10개.

| 시나리오 | 총 요청 | 성공 (차감) | 실패 (품절) | 최종 재고 | 기대 재고 | 비고 |
|----------|---------|-----------|-----------|----------|----------|------|
| naive (단순 SELECT + UPDATE) | 20 | 20 | 0 | -10 | 0 | DB 레벨 Race Condition |
| pessimistic (SELECT ... FOR UPDATE) | 20 | 10 | 10 | 0 | 0 | 정상 |
| optimistic (version 기반) | 20 | 10 | 10 | 0 | 0 | 정상 (재시도 포함) |

측정 환경: M1 Mac, Python 3.12, MySQL 8.0 (InnoDB), SQLAlchemy 2.0, FastAPI 0.111, k6 20 VUs

naive에서 20건 전부 성공이다. 재고가 10개인데 20개를 팔아버렸다. Ch.5와 완전히 같은 구조다. 두 Transaction이 "같은 순간에 같은 재고 값"을 읽고, 둘 다 "재고 >= 1"이니까 통과하고, 둘 다 차감한다.

DB가 알아서 관리해주지 않는다. Transaction을 쓰더라도, Isolation Level에 따라 동시 읽기에 대한 보호 수준이 다르다. 기본 설정만으로는 "읽기 -> 체크 -> 쓰기"의 원자성을 보장하지 않는다.


## 15-4. 코드 설명

### naive: 단순 SELECT + UPDATE

```python
@router.post("/product/purchase-naive")
def purchase_naive(product_id: int = 1, quantity: int = 1):
    with Session(engine) as session:
        # 1) 재고를 읽는다 (잠금 없음)
        product = session.query(Product).filter(Product.id == product_id).first()

        # 2) 인위적 지연 (Race Condition 재현용)
        time.sleep(0.05)

        # 3) 재고 체크
        if product.stock >= quantity:
            product.stock -= quantity
            session.commit()
            return {"result": "success", "remaining_stock": product.stock}
        else:
            return {"result": "sold_out", "remaining_stock": product.stock}
```

Ch.5에서 본 패턴과 동일하다. `SELECT`로 재고를 읽고, Python에서 비교하고, `UPDATE`로 차감한다. 이 사이에 다른 Transaction이 끼어들 수 있다.

시간순으로 보면:

```
Transaction A: SELECT stock FROM products WHERE id=1;  --> stock = 1
Transaction B: SELECT stock FROM products WHERE id=1;  --> stock = 1 (같은 값!)
Transaction A: UPDATE products SET stock = 0 WHERE id=1;
Transaction A: COMMIT;
Transaction B: UPDATE products SET stock = -1 WHERE id=1;  -- A가 0으로 만든 줄 모른다
Transaction B: COMMIT;
```

"DB Transaction 안에서 실행하고 있는데 왜 이런 일이 벌어지는가?"

Transaction이 있다고 해서 다른 Transaction의 읽기를 막아주는 건 아니다. MySQL InnoDB의 기본 Isolation Level인 REPEATABLE READ에서, 일반 SELECT는 잠금 없이 실행된다. 이걸 Consistent Read(일관된 읽기)라고 한다. 읽기 성능을 위해 의도적으로 잠금을 걸지 않는 거다.

<details>
<summary>Consistent Read (일관된 읽기)</summary>

InnoDB의 MVCC(Multi-Version Concurrency Control) 기반 읽기 방식이다. SELECT 시점의 스냅샷을 읽는다. 다른 Transaction이 데이터를 변경하더라도, 이 Transaction은 시작 시점의 데이터를 본다. 잠금 없이 읽기 때문에 성능이 좋지만, "읽은 값이 현재 값과 다를 수 있다"는 위험이 있다.
(PostgreSQL도 MVCC 기반이라 같은 방식으로 동작한다.)

</details>

"읽기에 잠금이 없으면, 동시에 여러 Transaction이 같은 값을 읽을 수 있다는 거 아닌가?"

맞다. 그래서 해결책이 필요하다.


### pessimistic: SELECT ... FOR UPDATE (비관적 잠금)

```python
@router.post("/product/purchase-pessimistic")
def purchase_pessimistic(product_id: int = 1, quantity: int = 1):
    with Session(engine) as session:
        # 1) 재고를 읽으면서 행에 쓰기 잠금을 건다
        product = (
            session.query(Product)
            .filter(Product.id == product_id)
            .with_for_update()  # SELECT ... FOR UPDATE
            .first()
        )

        time.sleep(0.05)

        # 2) 재고 체크
        if product.stock >= quantity:
            product.stock -= quantity
            session.commit()
            return {"result": "success", "remaining_stock": product.stock}
        else:
            session.rollback()
            return {"result": "sold_out", "remaining_stock": product.stock}
```

`with_for_update()`가 핵심이다. SQL로 보면 `SELECT ... FOR UPDATE`다. 이 쿼리가 실행되면 해당 행에 배타적 잠금(Exclusive Lock)이 걸린다. 다른 Transaction이 같은 행에 `SELECT ... FOR UPDATE`를 실행하면, 현재 Transaction이 COMMIT 또는 ROLLBACK할 때까지 기다린다.

<details>
<summary>SELECT ... FOR UPDATE</summary>

SELECT 결과 행에 배타적 잠금(Exclusive Lock, X Lock)을 거는 구문이다. 다른 Transaction의 `SELECT ... FOR UPDATE`와 `UPDATE`, `DELETE`를 블로킹한다. 단, 일반 `SELECT`(Consistent Read)는 잠금 없이 읽을 수 있다. Transaction이 끝나면(COMMIT/ROLLBACK) 잠금이 해제된다.
Ch.5의 `threading.Lock()`과 같은 역할이라고 보면 된다. 차이는 Lock의 범위가 "행(row)" 단위라는 점이다.

</details>

시간순으로 보면:

```
Transaction A: SELECT ... FOR UPDATE WHERE id=1;  --> stock = 1, 행 잠금
Transaction B: SELECT ... FOR UPDATE WHERE id=1;  --> 대기 (A가 잠금 해제할 때까지)
Transaction A: UPDATE stock = 0;
Transaction A: COMMIT;  --> 잠금 해제
Transaction B: SELECT ... FOR UPDATE WHERE id=1;  --> 이제 읽힌다, stock = 0
Transaction B: if 0 >= 1 --> False --> "품절"
```

Ch.5에서 `with lock:` 안에서 "읽기 -> 체크 -> 쓰기"를 묶었던 것과 같은 원리다.

<details>
<summary>Pessimistic Lock (비관적 잠금)</summary>

"충돌이 발생할 거라고 비관적으로 가정"하고, 데이터를 읽는 시점에 미리 잠금을 거는 전략이다. `SELECT ... FOR UPDATE`가 대표적이다. 충돌이 잦은 환경(한정 수량 이벤트 등)에서 유리하다. 단점은 잠금을 잡고 있는 동안 다른 Transaction이 대기해야 하므로 처리량(Throughput)이 낮아질 수 있다는 점이다.
(Java/JPA에서는 `@Lock(LockModeType.PESSIMISTIC_WRITE)`로 같은 동작을 한다.)

</details>


### optimistic: version 기반 (낙관적 잠금)

```python
@router.post("/product/purchase-optimistic")
def purchase_optimistic(product_id: int = 1, quantity: int = 1):
    max_retries = 3
    for attempt in range(max_retries):
        with Session(engine) as session:
            # 1) 재고를 읽는다 (잠금 없음, version도 같이 읽는다)
            product = session.query(Product).filter(Product.id == product_id).first()

            if product.stock < quantity:
                return {"result": "sold_out", "remaining_stock": product.stock}

            current_version = product.version

            time.sleep(0.05)

            # 2) UPDATE할 때 version이 그대로인지 확인한다
            rows_updated = (
                session.query(Product)
                .filter(
                    Product.id == product_id,
                    Product.version == current_version  # 핵심: 읽었을 때 version과 같은가?
                )
                .update({
                    Product.stock: Product.stock - quantity,
                    Product.version: Product.version + 1  # version 증가
                })
            )
            session.commit()

            if rows_updated == 1:
                return {"result": "success"}
            # rows_updated == 0이면 다른 Transaction이 먼저 수정한 것 -> 재시도

    return {"result": "conflict", "message": "재시도 횟수 초과"}
```

비관적 잠금과는 반대 전략이다. "충돌이 별로 안 날 거라고 낙관적으로 가정"한다. 읽을 때는 잠금을 걸지 않는다. UPDATE할 때 "내가 읽었을 때와 데이터가 변하지 않았는가?"를 version 컬럼으로 확인한다.

<details>
<summary>Optimistic Lock (낙관적 잠금)</summary>

"충돌이 별로 없을 거라고 낙관적으로 가정"하고, 잠금 없이 읽은 뒤, 쓸 때 충돌 여부를 확인하는 전략이다. version 컬럼이나 timestamp를 이용한다. 충돌이 적은 환경(일반적인 CRUD)에서 유리하다. 충돌 시 재시도가 필요하므로, 충돌이 잦으면 오히려 비용이 커진다.
(Java/JPA에서는 `@Version` 어노테이션으로 자동 관리된다.)

</details>

시간순으로 보면:

```
Transaction A: SELECT id=1 --> stock=1, version=5
Transaction B: SELECT id=1 --> stock=1, version=5
Transaction A: UPDATE SET stock=0, version=6 WHERE id=1 AND version=5  --> 1 row updated
Transaction B: UPDATE SET stock=0, version=6 WHERE id=1 AND version=5  --> 0 rows updated (version이 이미 6)
Transaction B: 재시도 --> SELECT --> stock=0 --> "품절"
```

Transaction B의 UPDATE가 0 rows를 반환했다. version이 이미 바뀌었기 때문이다. "내가 읽은 사이에 누군가 수정했구나"를 감지한 거다.


### 비관적 잠금 vs 낙관적 잠금

| 비교 항목 | 비관적 잠금 (Pessimistic) | 낙관적 잠금 (Optimistic) |
|-----------|--------------------------|--------------------------|
| 전략 | 충돌이 날 거라고 가정, 미리 잠근다 | 충돌이 안 날 거라고 가정, 나중에 확인한다 |
| 구현 | SELECT ... FOR UPDATE | version 컬럼 + WHERE 조건 |
| 장점 | 충돌 시 확실하게 차단 | 잠금 대기가 없어서 처리량이 높다 |
| 단점 | 잠금 대기로 처리량이 낮아질 수 있다 | 충돌 시 재시도 비용 |
| 적합한 상황 | 한정 수량 이벤트, 금융 거래 | 일반적인 게시판, 설정 변경 |

Ch.5에서 `threading.Lock()`이 비관적 잠금이었다면, 낙관적 잠금은 "일단 하고 보자, 충돌 나면 다시 하자"는 전략이다.


## Transaction과 ACID

"그래서 Transaction이 정확히 뭔가?"

Transaction은 "다 되거나, 아예 안 되거나" 하는 작업의 묶음이다.

<details>
<summary>Transaction (트랜잭션)</summary>

데이터베이스에서 하나의 논리적 작업 단위를 구성하는 연산들의 묶음이다. "재고를 읽고 -> 체크하고 -> 차감한다"를 하나의 Transaction으로 묶으면, 중간에 실패해도 처음 상태로 되돌릴 수 있다(Rollback). 전부 성공해야만 반영된다(Commit).
Ch.5의 Critical Section과 비슷한 개념이지만, Transaction은 DB 레벨에서의 원자적 작업 단위라는 점이 다르다.

</details>

Transaction이 보장해야 하는 4가지 성질이 ACID다.

<details>
<summary>ACID</summary>

Transaction이 지켜야 하는 4가지 성질의 약자다.

- Atomicity (원자성): 트랜잭션의 모든 연산이 전부 성공하거나, 전부 실패해야 한다. 절반만 반영되면 안 된다.
- Consistency (일관성): 트랜잭션 실행 전후로 데이터베이스가 일관된 상태를 유지해야 한다. 재고가 -10이 되면 일관성이 깨진 거다.
- Isolation (격리성): 동시에 실행되는 트랜잭션들이 서로 간섭하지 않아야 한다. 마치 순차적으로 실행한 것처럼 보여야 한다.
- Durability (지속성): 커밋된 트랜잭션의 결과는 시스템 장애가 발생해도 유지되어야 한다. 디스크에 기록되어야 한다.

Ch.5에서 다뤘던 Atomicity가 ACID의 A다. Ch.5에서는 Python 레벨이었다면, 여기서는 DB 레벨이다.

</details>

ACID 중에서 이번 챕터의 핵심은 I(Isolation, 격리성)다.

naive 코드에서 재고가 마이너스가 된 건 Isolation이 완벽하지 않아서다. 두 Transaction이 서로의 작업을 볼 수 있었고, 간섭했다. 완벽한 Isolation이면 이런 일이 안 생기지만, 완벽한 격리는 성능 비용이 크다. 그래서 DB는 Isolation Level이라는 "격리 수준의 단계"를 둔다.

왜 격리 수준이 4단계나 있는지, 각 단계에서 어떤 문제가 생기는지, 다음에서 파고든다.

---

[< 환경 세팅](./README.md) | [Isolation Level >](./02-isolation-levels.md)
