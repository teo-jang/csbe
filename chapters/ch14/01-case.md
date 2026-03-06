# Ch.14 사례 - 느리니까 Redis 붙였는데 캐시 만료되면 여전히 느리다

[< 환경 세팅](./README.md) | [인덱스 설계 >](./02-index-design.md)

---

앞에서 ORM이 만드는 SQL을 직접 확인해야 한다는 걸 봤다. 이번에는 한 단계 더 들어간다. SQL 자체가 느린 원인을 진단하지 않고, 캐시로 덮어버리면 어떤 일이 벌어지는가.


## 14-1. 사례 설명

2년차 백엔드 개발자가 주문 내역 조회 API를 만들고 있다. 유저 ID로 주문 내역을 가져오는 단순한 쿼리다.

```python
@app.get("/orders/{user_id}")
async def get_orders(user_id: int):
    result = db.execute(
        text("SELECT * FROM orders WHERE user_id = :uid ORDER BY created_at DESC LIMIT 20"),
        {"uid": user_id}
    )
    return result.fetchall()
```

개발 환경에서는 빠르다. orders 테이블에 데이터가 500건밖에 없으니까. 운영에 배포하고 3개월이 지나자 orders 테이블이 300만 건이 됐다. API 응답 시간이 2초를 넘기기 시작한다.

팀 리드가 말한다.

"느리면 Redis에 캐싱하면 되지 않나?"

그래서 Redis를 도입한다.

```python
@app.get("/orders/{user_id}")
async def get_orders(user_id: int):
    # Redis에서 먼저 조회
    cache_key = f"orders:{user_id}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    # 캐시 미스: DB 조회
    result = db.execute(
        text("SELECT * FROM orders WHERE user_id = :uid ORDER BY created_at DESC LIMIT 20"),
        {"uid": user_id}
    )
    orders = result.fetchall()

    # 캐시에 저장 (TTL 5분)
    redis.setex(cache_key, 300, json.dumps(orders))
    return orders
```

캐시가 살아있는 5분 동안은 빠르다. 그런데 TTL이 만료되면? 다시 2초짜리 쿼리가 날아간다. 유저가 새 주문을 하면? 캐시를 무효화해야 하고, 다음 조회에서 또 2초가 걸린다.

"캐시를 더 오래 유지하면 되지 않나?"

그래서 TTL을 30분으로 늘린다. 이제 유저가 방금 한 주문이 30분 동안 목록에 안 뜬다. CS팀에 문의가 쏟아진다.

"주문했는데 내역에 안 보여요."


## 14-2. 결과 예측

여기서 질문이다.

- 이 쿼리가 느린 진짜 원인은 뭔가?
- `EXPLAIN`을 찍어보면 어떤 결과가 나올까?
- 인덱스 하나 추가하면 얼마나 빨라질까?
- 그래도 Redis가 필요한가?

<!-- 기대 키워드: Full Table Scan, B-Tree Index, Covering Index, EXPLAIN, type: ALL, type: ref, Cardinality -->


## 14-3. 결과 분석

원인부터 확인한다. `EXPLAIN`을 찍어본다.

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 20;
```

결과:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | orders | ALL | NULL | NULL | 3,012,458 | Using where; Using filesort |

`type: ALL`. Full Table Scan이다. 300만 건을 처음부터 끝까지 훑고 있다. `possible_keys: NULL`. 사용 가능한 인덱스가 아예 없다. `Extra: Using filesort`. 정렬도 별도로 수행하고 있다.

(Ch.11에서 `type: ALL`이 최악이라고 했다. 기억나는가?)

이제 인덱스를 추가한다.

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

다시 `EXPLAIN`:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | orders | ref | idx_orders_user_id | idx_orders_user_id | 47 | Using where; Using filesort |

`type: ref`. 인덱스를 타고 있다. `rows: 47`. 해당 user_id의 주문 47건만 읽는다. 300만 건에서 47건으로 줄었다. 6만 4천배 차이다.

하지만 `Extra: Using filesort`가 아직 남아 있다. 47건을 created_at으로 정렬하는 건 무시할 수 있는 수준이지만, 더 최적화할 수 있다.

```sql
DROP INDEX idx_orders_user_id ON orders;
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
```

복합 인덱스(Composite Index)로 바꾸면:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | orders | ref | idx_orders_user_created | idx_orders_user_created | 47 | Backward index scan |

`Using filesort`가 사라졌다. 인덱스 자체가 user_id + created_at DESC로 정렬되어 있으니, 별도 정렬이 필요 없다. 인덱스 순서대로 앞에서 20개만 꺼내면 끝이다.

정리하면:

| 방식 | 스캔 행 수 | filesort | 응답 시간 (참고) |
|------|-----------|----------|-----------------|
| 인덱스 없음 (type: ALL) | 3,012,458 | 있음 | ~2,100ms |
| 단일 인덱스 user_id (type: ref) | 47 | 있음 | ~15ms |
| 복합 인덱스 user_id + created_at (type: ref) | 47 | 없음 | ~3ms |
| Redis 캐시 (TTL 내) | 0 (DB 안 감) | - | ~1ms |

측정 환경: MySQL 8.0, Docker (M1 Mac, 8GB RAM), orders 테이블 300만 건, user_id당 평균 47건

Redis 캐시가 1ms로 가장 빠르다. 그런데 복합 인덱스만으로도 3ms다. 2,100ms에서 3ms. 700배 개선이다. 이 정도면 대부분의 서비스에서 Redis 없이도 충분하다.

Redis를 붙이기 전에 물어봐야 할 질문은 "어떻게 캐싱할까"가 아니라 "왜 느린가"다.


## 14-4. 코드 설명

### EXPLAIN의 type 컬럼 해석

Ch.11에서 잠깐 언급했던 EXPLAIN의 type 컬럼을 이번에 자세히 본다. MySQL 기준으로, 좋은 순서대로 나열하면:

| type | 의미 | 성능 |
|------|------|------|
| system | 테이블에 행이 1개 | 최상 |
| const | Primary Key 또는 Unique Index로 1건 조회 | 최상 |
| eq_ref | JOIN에서 Primary Key로 1건씩 매칭 | 매우 좋음 |
| ref | Non-unique Index로 조회 | 좋음 |
| range | 인덱스에서 범위 조회 (BETWEEN, >, <) | 괜찮음 |
| index | 인덱스 전체를 스캔 (Full Index Scan) | 나쁨 |
| ALL | 테이블 전체를 스캔 (Full Table Scan) | 최악 |

`ALL`이 나오면 일단 의심해야 한다. 데이터가 1,000건 이하라면 Full Table Scan이 더 빠를 수도 있다. (인덱스를 타는 것도 비용이니까.) 하지만 수만 건 이상이면 `ALL`은 거의 항상 문제다.

<details>
<summary>Full Table Scan (풀 테이블 스캔)</summary>

테이블의 모든 행을 처음부터 끝까지 읽는 것이다. Ch.10에서 본 List의 Linear Search와 같은 원리다. 인덱스가 없거나 인덱스를 탈 수 없는 쿼리에서 발생한다. EXPLAIN에서 `type: ALL`로 나타난다. 데이터가 적을 때는 오히려 Index Scan보다 빠를 수 있지만, 수만 건 이상에서는 성능의 적이다.

</details>

<details>
<summary>Index Scan (인덱스 스캔)</summary>

인덱스 자료구조(B+Tree)를 따라가면서 조건에 맞는 행만 찾는 것이다. Full Table Scan과 달리 필요한 데이터만 읽는다. EXPLAIN에서 `type: ref`, `type: range`, `type: const` 등으로 나타난다. Ch.11에서 다뤘던 B+Tree가 이 인덱스의 실체다.

</details>

### 사례의 핵심

이 사례에서 중요한 건 세 가지다.

첫째, Redis를 붙이기 전에 EXPLAIN을 찍어봤어야 한다. EXPLAIN 한 번이면 `type: ALL`이 보이고, 인덱스가 없다는 걸 바로 알 수 있다. 이걸 건너뛰고 Redis부터 도입한 거다.

둘째, 캐시는 원인을 제거하지 않는다. 캐시가 만료되면 느린 쿼리가 그대로 실행된다. TTL을 늘리면 데이터 정합성이 깨진다. 캐시 무효화 로직이 복잡해진다. 운영 비용이 늘어난다.

셋째, 인덱스 하나로 700배 빨라졌다. Redis 도입 비용 (인프라, 캐시 무효화 로직, 장애 대응)을 생각하면, 인덱스가 압도적으로 효율적인 해결책이다.

캐시가 필요한 경우는 분명 있다. DB에 부하를 줄여야 하는 경우, 같은 데이터를 수천 명이 동시에 조회하는 경우, 계산 비용이 큰 결과를 재활용하는 경우. 하지만 "느리니까 캐시"는 순서가 틀렸다. "왜 느린지 확인하고, 그래도 느리면 캐시"가 맞다.

(Ch.17에서 Redis 캐시를 언제, 어떻게 쓰는 게 맞는지를 다룬다. 그때까지 "Redis부터 붙이는 습관"은 좀 참아두자.)

그러면 인덱스를 어떻게 설계해야 하는가? 단일 인덱스와 복합 인덱스의 차이는 뭔가? 어떤 경우에 인덱스가 안 타는가? 다음에서 본다.

---

[< 환경 세팅](./README.md) | [인덱스 설계 >](./02-index-design.md)
