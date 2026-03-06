# Ch.16 쿼리 최적화의 실무

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 Slow Query가 Connection Pool을 고갈시키는 메커니즘을 확인했다. 인덱스를 걸고, OFFSET을 Cursor-based로 바꾸고, SELECT *를 없앴다. 이번에는 쿼리 최적화의 실무 기법을 더 넓게 본다.


## 서브쿼리 vs JOIN vs EXISTS

같은 결과를 내는 쿼리를 세 가지 방식으로 쓸 수 있다. 성능이 다르다.

"주문이 있는 사용자 목록"을 구한다고 하자.

### 서브쿼리 (IN)

```sql
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders);
```

서브쿼리가 먼저 실행되어 user_id 목록을 만들고, 외부 쿼리가 그 목록과 비교한다. 서브쿼리 결과가 크면 느려진다. MySQL 옵티마이저가 서브쿼리를 풀어서 JOIN으로 바꾸기도 하지만 (semijoin 최적화), 항상 그런 건 아니다.

### JOIN

```sql
SELECT DISTINCT u.* FROM users u
JOIN orders o ON u.id = o.user_id;
```

두 테이블을 조인한다. 주문이 여러 건인 사용자는 중복되므로 `DISTINCT`가 필요하다. 대량 데이터에서 DISTINCT 자체가 비용이다.

### EXISTS

```sql
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

users 테이블의 각 행에 대해 "orders에 매칭되는 행이 하나라도 있는가?"를 확인한다. 하나만 찾으면 멈춘다. 전부 읽지 않는다.

### 성능 비교

| 방식 | orders 100만 건 기준 | 특징 |
|------|---------------------|------|
| IN (서브쿼리) | 서브쿼리 결과 크기에 비례 | 옵티마이저가 개선해주기도 하지만 불확실 |
| JOIN + DISTINCT | 조인 결과 + 중복 제거 비용 | 중복이 많으면 DISTINCT 비용이 큼 |
| EXISTS | 첫 매칭에서 즉시 종료 | "있다/없다"만 확인할 때 가장 효율적 |

(출처: MySQL 8.0 Reference Manual, "Optimizing Subqueries, Derived Tables, View References, and Common Table Expressions")

"주문이 있는 사용자"처럼 "존재 여부"만 확인할 때는 EXISTS가 가장 효율적인 경우가 많다. 하나만 찾으면 거기서 멈추니까. 반면에 "주문 정보도 같이 가져와야 하는" 경우에는 JOIN이 맞다.

그런데 이건 일반적인 경향이지, 항상 그런 건 아니다. MySQL의 옵티마이저는 버전마다 다르게 동작한다. 반드시 EXPLAIN으로 실행 계획을 확인해야 한다. Ch.11에서 "추측하지 말고 측정하라"고 했다. 쿼리 최적화에서도 같은 원칙이다.

```sql
EXPLAIN SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

`type`, `key`, `rows` 컬럼을 보면 옵티마이저가 어떤 전략을 선택했는지 알 수 있다.


## Pagination: OFFSET의 함정

앞의 사례에서 OFFSET이 느린 걸 확인했다. 좀 더 파고들어보자.

### OFFSET이 느린 이유

OFFSET은 "건너뛰기"가 아니다. "읽고 버리기"다. DB 엔진 입장에서 `LIMIT 20 OFFSET 100,000`은 다음과 같다:

```
1. WHERE 조건에 맞는 행을 찾는다
2. ORDER BY로 정렬한다
3. 1번째 행부터 100,000번째 행까지 읽는다 ← 이 비용을 피할 수 없다
4. 100,001번째부터 100,020번째 행을 반환한다
```

인덱스가 있어도 마찬가지다. 인덱스를 타서 정렬을 생략할 수 있지만, 인덱스 리프 노드를 100,000개 순회하는 비용은 여전히 발생한다. OFFSET이 커질수록 선형적으로 느려진다.

### Cursor-based Pagination 상세

```sql
-- 첫 페이지
SELECT id, created_at, total_price
FROM orders
WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01'
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- 다음 페이지 (이전 페이지의 마지막 행: created_at='2024-01-28 10:00:00', id=54321)
SELECT id, created_at, total_price
FROM orders
WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01'
  AND (created_at, id) < ('2024-01-28 10:00:00', 54321)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

`(created_at, id) < (last_value, last_id)` 조건이 핵심이다. 이 조건이 있으면 DB는 인덱스에서 해당 지점을 O(log n)으로 바로 찾고, 거기서 20개만 읽는다. 1페이지든 5,000페이지든 성능이 동일하다.

왜 `id`를 같이 쓰는가? `created_at`이 같은 행이 여러 개 있을 수 있다. 같은 초에 주문이 10건 들어왔으면 `created_at`만으로는 순서가 불확실하다. `id`를 보조 정렬 키로 쓰면 행 단위로 유일한 순서가 보장된다.

### OFFSET vs Cursor 비교

| 항목 | OFFSET | Cursor-based |
|------|--------|--------------|
| 구현 복잡도 | 단순 | 약간 복잡 |
| 뒤쪽 페이지 성능 | OFFSET에 비례해서 느려짐 | 일정 |
| "N번째 페이지로 이동" | 가능 | 불가 |
| 무한 스크롤 | 느림 | 적합 |
| 데이터 삽입 시 중복/누락 | 발생 가능 | 발생 안 함 |

마지막 항목이 의외로 중요하다. OFFSET 방식에서 1페이지를 읽은 뒤 새 데이터가 삽입되면, 2페이지에서 1페이지의 마지막 항목이 다시 나올 수 있다. Cursor-based는 기준점 이후의 데이터만 가져오니까 이 문제가 없다.

(단, "3페이지로 바로 이동" 같은 UI가 필요하면 OFFSET을 쓸 수밖에 없다. 이 경우에도 `WHERE id > ? LIMIT N` 패턴으로 성능을 개선할 수 있는지 먼저 검토해봐라.)


## 그 너머: Partitioning, Sharding, Read Replica

인덱스를 걸고, 쿼리를 최적화하고, Cursor-based Pagination을 적용했다. 그래도 한계가 오는 시점이 있다. 데이터가 수억 건을 넘어가거나, 쓰기 부하가 극단적으로 높을 때다.

### Partitioning

하나의 테이블을 물리적으로 여러 조각으로 나누는 기법이다.

```sql
-- 월별 파티셔닝 예시
CREATE TABLE orders (
    id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    ...
) PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    PARTITION p202403 VALUES LESS THAN (202404),
    ...
);
```

`WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'` 쿼리가 들어오면, MySQL은 p202401 파티션만 스캔한다. 나머지 11개월 데이터는 아예 안 본다. 이걸 Partition Pruning이라고 한다.

<details>
<summary>Partitioning (파티셔닝)</summary>

하나의 논리적 테이블을 여러 물리적 조각으로 나누는 기법이다. 애플리케이션 코드는 바꿀 필요 없다. DB가 알아서 해당 파티션만 읽는다. 시간 기반 데이터(로그, 주문, 이벤트)에 특히 효과적이다. 오래된 파티션을 통째로 DROP하면 DELETE보다 훨씬 빠르게 정리할 수 있다. 인덱스와 결합하면 스캔 범위를 극적으로 줄일 수 있다.

</details>

### Sharding

Partitioning이 "한 DB 안에서 테이블을 나누는 것"이라면, Sharding은 "여러 DB 서버에 데이터를 분산하는 것"이다.

```
Shard 1: user_id % 4 == 0
Shard 2: user_id % 4 == 1
Shard 3: user_id % 4 == 2
Shard 4: user_id % 4 == 3
```

각 Shard가 별도의 MySQL 서버다. 하나의 서버가 감당할 수 없는 데이터량이나 쓰기 부하를 분산한다.

<details>
<summary>Sharding (샤딩)</summary>

데이터를 여러 DB 서버에 수평 분할하는 기법이다. 쓰기 성능을 선형적으로 확장할 수 있다. 하지만 비용이 크다. Cross-Shard JOIN이 불가능하고, 트랜잭션 관리가 복잡해지고, Shard 간 데이터 이동(리밸런싱)이 어렵다. "Sharding은 마지막 수단"이라는 말이 있을 정도다. 인덱스 최적화, 쿼리 최적화, Read Replica, 캐시를 전부 적용한 뒤에도 한계가 올 때 고려한다.

</details>

Sharding은 이 강의의 범위를 넘는다. "이런 게 있다"는 것만 알면 된다. 핵심은 "Sharding을 하기 전에 할 수 있는 최적화가 아직 많다"는 거다.

### Read Replica

쓰기는 Primary(Master)에서, 읽기는 Replica(Slave)에서 처리하는 구조다.

```
쓰기 요청 → Primary DB
읽기 요청 → Replica DB (1~N대)
```

대부분의 웹 서비스는 읽기 비율이 80~90%다. 읽기를 Replica로 분산하면 Primary의 부하가 크게 줄어든다.

<details>
<summary>Read Replica (읽기 전용 복제본)</summary>

Primary DB의 데이터를 실시간으로 복제하는 읽기 전용 DB 서버다. Primary에서 쓰기가 발생하면 binlog를 통해 Replica에 전파된다. Replication Lag(복제 지연)이 발생할 수 있어서, "방금 쓴 데이터를 즉시 읽어야 하는" 경우에는 Primary에서 읽어야 한다. Python의 SQLAlchemy에서는 `binds` 설정으로 읽기/쓰기를 다른 DB로 라우팅할 수 있다.

</details>

Read Replica를 쓸 때 주의할 점: Replication Lag. Primary에서 INSERT한 직후에 Replica에서 SELECT하면 아직 데이터가 없을 수 있다. "주문 완료 후 주문 내역 조회"처럼 방금 쓴 데이터를 바로 읽어야 하는 경우에는 Primary에서 읽어야 한다. 이 판단을 코드에서 해야 한다.

```python
# 쓰기는 Primary
with primary_engine.connect() as conn:
    conn.execute(insert_order)
    conn.commit()

# 읽기는 Replica (단, 방금 쓴 데이터를 바로 읽어야 하면 Primary에서)
with replica_engine.connect() as conn:
    result = conn.execute(select_orders)
```

### 언제 뭘 쓰는가

```
1단계: 인덱스 최적화 + 쿼리 최적화 (이 챕터의 주제)
  ↓ 그래도 느리면
2단계: Read Replica로 읽기 분산
  ↓ 그래도 느리면
3단계: Partitioning으로 스캔 범위 축소
  ↓ 그래도 느리면
4단계: 캐시 도입 (Ch.17~18에서 다룬다)
  ↓ 그래도 느리면
5단계: Sharding (마지막 수단)
```

순서가 중요하다. 인덱스도 안 걸어놓고 Sharding부터 이야기하는 건 "집 정리 안 하고 이사 가겠다"는 거다. Ch.14의 제목이 "인덱스를 안 걸어놓고 Redis를 설치했습니다"였다. 같은 맥락이다.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
