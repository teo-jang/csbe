# Ch.17 사례: Cache를 붙였더니 장애가 났다

[< 환경 세팅](./README.md) | [Cache 전략과 설계 >](./02-cache-strategy.md)

---

앞에서 Part 4를 마무리하면서 "DB를 최적화했는데도 한계가 있으면 캐시를 쓴다"고 했다. 이번에는 캐시를 실제로 붙여본다. 그런데 붙이기만 하면 되는 줄 알았는데, 캐시 때문에 장애가 난다.


## 17-1. 사례 설명

이커머스 서비스의 상품 상세 API가 있다. 상품 정보, 가격, 리뷰 수, 판매량을 조합해서 반환한다. 테이블 3개를 JOIN하고, 리뷰 수를 집계한다.

```python
@app.get("/products/{product_id}")
async def get_product(product_id: int):
    result = db.execute(text("""
        SELECT p.*, COUNT(r.id) as review_count, s.total_sold
        FROM products p
        LEFT JOIN reviews r ON r.product_id = p.id
        LEFT JOIN sales_summary s ON s.product_id = p.id
        WHERE p.id = :pid
        GROUP BY p.id
    """), {"pid": product_id})
    return result.first()
```

인덱스도 걸려 있고 쿼리도 최적화했다. 그래도 응답 시간이 50ms 정도 나온다. 50ms면 나쁘지 않다. 그런데 이 상품 상세 페이지가 서비스에서 가장 트래픽이 많은 페이지다. 초당 2,000 요청이 들어온다. 매 요청마다 DB를 때린다.

DB Connection Pool이 20개다. 각 쿼리가 50ms 걸리면 초당 처리량은 `20 / 0.05 = 400 req/s`다. 2,000 req/s를 감당하려면 Pool이 100개는 있어야 한다. Pool을 100개로 늘리면 MySQL `max_connections`에 부담이 간다. 서버가 여러 대면 더 심하다.

(Ch.16에서 다뤘던 공식을 떠올려보자. `서버 대수 x (pool_size + max_overflow) < DB max_connections`. 서버 3대 x pool_size 100이면 300개. MySQL 기본 max_connections는 151이다.)

팀 리드가 말한다. "Redis 캐시 붙여. 상품 정보는 자주 안 바뀌잖아."

맞는 말이다. 이번에는 Ch.14와 다르다. 인덱스도 걸려 있고, 쿼리도 최적화했다. 그래도 트래픽이 감당이 안 되는 거다. 캐시를 붙일 타이밍이 맞다.

```python
import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, db=0)

@app.get("/products/{product_id}")
async def get_product(product_id: int):
    cache_key = f"product:{product_id}"

    # 1. 캐시에서 먼저 조회
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. 캐시 미스: DB 조회
    result = db.execute(text("""
        SELECT p.*, COUNT(r.id) as review_count, s.total_sold
        FROM products p
        LEFT JOIN reviews r ON r.product_id = p.id
        LEFT JOIN sales_summary s ON s.product_id = p.id
        WHERE p.id = :pid
        GROUP BY p.id
    """), {"pid": product_id})
    product = result.first()

    # 3. 캐시에 저장 (TTL 5분)
    redis_client.setex(cache_key, 300, json.dumps(dict(product._mapping)))

    return product
```

<details>
<summary>Cache (캐시)</summary>

자주 접근하는 데이터를 원본 저장소보다 빠른 곳에 미리 복사해두는 기법이다. CPU Cache가 RAM보다 빠르듯이, Redis가 MySQL보다 빠르다. 핵심은 "같은 데이터를 반복해서 읽는 패턴"에서 효과가 있다는 거다. 한 번만 읽는 데이터를 캐싱하면 오히려 메모리 낭비다. "읽기 비율이 높고, 같은 데이터에 대한 반복 접근이 많은" 상황이 캐시의 적용 조건이다.

(Python의 `functools.lru_cache`도 같은 원리다. 함수 결과를 메모리에 저장해두고 같은 인자로 호출하면 저장된 결과를 반환한다.)

</details>

<details>
<summary>Cache Hit / Cache Miss</summary>

캐시에 원하는 데이터가 있으면 Cache Hit, 없으면 Cache Miss다. Hit Rate = Hit / (Hit + Miss). Hit Rate가 99%라는 건 100번 요청 중 99번은 캐시에서, 1번만 DB에서 가져온다는 뜻이다. Hit Rate가 높을수록 DB 부하가 줄어든다.

Hit Rate를 결정하는 요소는 세 가지다: TTL (얼마나 오래 유지하는가), 데이터 패턴 (같은 데이터를 반복 조회하는가), 캐시 크기 (충분히 저장할 수 있는가).

</details>

배포했다. 캐시가 워밍업되고 나니 응답 시간이 1ms로 떨어졌다. 50배 빨라졌다. DB 부하도 급감했다. Hit Rate가 98%를 넘는다. 성공이다.

2주간 아무 문제 없이 돌아갔다. 그런데 어느 날 오전 10시, 서비스 전체가 먹통이 됐다.


### 장애 발생

타임라인:

```
10:00:00 - 인기 상품 100개의 캐시 TTL이 동시에 만료
10:00:01 - 해당 상품에 대한 요청 200+개가 전부 Cache Miss
10:00:01 - 200+개의 요청이 동시에 DB 조회 시작
10:00:02 - DB Connection Pool 20개 전부 소진
10:00:02 - 나머지 요청 대기 시작
10:00:05 - Connection 타임아웃 발생
10:00:05 - API 응답 타임아웃, 에러 응답 폭증
10:00:10 - 캐시가 다시 채워지기 시작, 서서히 복구
```

5분짜리 TTL로 캐시를 설정했다. 인기 상품 100개가 비슷한 시간에 캐시에 올라갔으니, 비슷한 시간에 만료된다. 만료되는 순간, 그 상품에 대한 모든 요청이 동시에 DB를 때린다.

<details>
<summary>Cache Stampede (캐시 스탬피드)</summary>

캐시가 만료되는 순간 대량의 요청이 동시에 원본 저장소(DB)를 조회하는 현상이다. "스탬피드"는 동물 떼가 한꺼번에 달려가는 것을 뜻한다. 정상 상태에서는 캐시가 DB를 보호하고 있다. 캐시가 사라지는 순간 보호막이 해제되면서 DB가 직격을 맞는다.

Ch.9에서 "AI가 만든 코드의 함정" 중 하나로 짧게 언급했다. 이번 챕터에서 본격적으로 다룬다.

(Go의 `singleflight` 패키지가 이 문제를 해결하기 위해 존재한다. 같은 키에 대한 중복 요청을 하나로 합쳐준다. Python에서는 직접 구현해야 한다.)

</details>

<details>
<summary>TTL (Time-To-Live)</summary>

캐시 데이터의 유효 기간이다. TTL이 300초면 캐시에 저장한 시점부터 300초가 지나면 자동으로 삭제된다. TTL이 없으면 캐시가 영원히 남아서 원본 데이터와 불일치가 생긴다. TTL이 너무 짧으면 Cache Miss가 잦아서 DB 부하가 높아진다. TTL이 너무 길면 데이터가 오래된 상태로 남는다.

DNS의 TTL, HTTP Cache의 max-age, CDN의 TTL 전부 같은 개념이다. "이 데이터를 얼마 동안 신뢰할 것인가"를 정하는 숫자다.

</details>

이 에피소드에서 중요한 건 "Cache Hit Rate 99%여도 안전하지 않다"는 점이다. 정상 상태의 Hit Rate는 의미가 없다. 문제는 TTL 만료 순간이다. 1%의 Cache Miss가 한꺼번에 몰리면 DB가 죽는다.


## 17-2. 결과 예측

여기서 질문이다.

- TTL을 더 길게 설정하면 해결되는가?
- TTL을 랜덤하게 흩뿌리면?
- Cache Miss가 발생할 때 DB 조회를 한 번만 하게 하면?
- 캐시가 만료되기 전에 미리 갱신하면?

<!-- 기대 키워드: Cache Stampede, TTL, Mutex Lock, Early Expiration, Probabilistic Early Recomputation -->


## 17-3. 결과 분석

### Cache가 있을 때와 없을 때

| 상태 | 응답 시간 | DB 쿼리 수 (초당) | DB Connection 사용 |
|------|----------|-------------------|-------------------|
| Cache Hit (정상) | ~1ms | ~20 (Miss 분만) | 1~2개 |
| Cache 없음 (전부 DB) | ~50ms | ~2,000 | Pool 전체 소진 |
| Cache Stampede (TTL 만료 순간) | 타임아웃 | 200+ 동시 쿼리 폭발 | Pool 전체 소진 + 대기열 |

참고 수치. Redis GET 명령의 응답 시간은 로컬 환경에서 0.1~1ms 수준이다 (출처: Redis 공식 벤치마크, redis.io/docs/management/optimization/benchmarks). DB 쿼리 50ms는 3-table JOIN + GROUP BY 기준.

Cache Hit 상태에서는 DB에 요청이 거의 안 간다. 초당 2,000 요청 중 98%가 Redis에서 처리되니까 DB에는 초당 40건 정도만 간다. Connection Pool 20개면 충분하다.

문제는 TTL 만료 순간이다. 인기 상품의 캐시가 만료되면 해당 상품에 대한 모든 동시 요청이 Cache Miss를 겪는다. 이 요청들이 전부 DB로 간다. 0.1초 사이에 200건의 쿼리가 동시에 실행된다. Pool 20개가 순식간에 고갈된다. 나머지 180건은 Pool에서 빈 Connection을 기다린다. Connection 타임아웃이 터진다. 에러가 연쇄적으로 발생한다.

(Ch.16에서 Slow Query가 Connection Pool을 고갈시킨 것과 메커니즘이 같다. 원인이 다를 뿐이다. Ch.16은 쿼리 하나가 오래 걸려서 Pool을 잡아먹은 거고, 여기서는 쿼리가 한꺼번에 몰려서 Pool을 잡아먹은 거다.)

### TTL을 길게 하면 해결되는가?

아니다. TTL을 30분으로 늘려도 결국 만료되는 순간은 온다. 만료 시점이 뒤로 밀릴 뿐이지, 문제 자체가 사라지지 않는다. 오히려 TTL이 길면 원본 데이터와의 불일치 시간이 길어진다. 상품 가격이 바뀌었는데 30분간 옛날 가격이 보이면 안 된다.


## 17-4. 코드 설명

### 기본 패턴: Cache-Aside (Lazy Loading)

사례에서 사용한 패턴이 Cache-Aside다. 가장 흔한 캐시 패턴이다.

```
1. 요청이 들어온다
2. 캐시에서 찾는다
3. 있으면 (Hit) → 캐시에서 반환
4. 없으면 (Miss) → DB에서 조회 → 캐시에 저장 → 반환
```

```python
async def get_product_cache_aside(product_id: int):
    cache_key = f"product:{product_id}"

    # Hit 확인
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Miss: DB 조회
    product = fetch_product_from_db(product_id)

    # 캐시에 저장
    redis_client.setex(cache_key, 300, json.dumps(product))

    return product
```

이 패턴의 문제가 바로 Cache Stampede다. 여러 요청이 동시에 Miss를 겪으면 전부 DB로 간다.


### 해결 1: Mutex Lock (분산 락)

Cache Miss가 발생하면, DB 조회 권한을 하나의 요청에만 준다. 나머지 요청은 잠시 기다렸다가 캐시가 채워지면 그걸 읽는다.

```python
import time

async def get_product_with_lock(product_id: int):
    cache_key = f"product:{product_id}"
    lock_key = f"lock:product:{product_id}"

    # 1. 캐시 확인
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. Lock 획득 시도 (NX: 키가 없을 때만 설정, EX: 5초 후 자동 해제)
    acquired = redis_client.set(lock_key, "1", nx=True, ex=5)

    if acquired:
        try:
            # Lock을 잡은 요청만 DB 조회
            product = fetch_product_from_db(product_id)
            redis_client.setex(cache_key, 300, json.dumps(product))
            return product
        finally:
            redis_client.delete(lock_key)
    else:
        # Lock을 못 잡은 요청: 잠시 대기 후 캐시 재확인
        for _ in range(50):  # 최대 5초 대기
            time.sleep(0.1)
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

        # 대기 후에도 캐시가 없으면 직접 DB 조회 (fallback)
        return fetch_product_from_db(product_id)
```

`redis_client.set(lock_key, "1", nx=True, ex=5)`가 핵심이다. `nx=True`는 "키가 존재하지 않을 때만 설정"이다. Redis의 SET NX는 원자적(atomic)이다. 200개의 요청이 동시에 시도해도 딱 하나만 성공한다.

(Ch.5에서 다뤘던 Mutex와 같은 원리다. `threading.Lock()`이 한 번에 하나의 스레드만 Critical Section에 들어가게 하듯이, Redis의 SET NX가 한 번에 하나의 요청만 DB 조회를 하게 한다. 차이가 있다면 `threading.Lock()`은 한 프로세스 안의 스레드 간 동기화이고, Redis Lock은 여러 서버에 걸친 분산 환경에서의 동기화라는 점이다.)

`ex=5`는 Lock의 TTL이다. Lock을 잡은 요청이 장애로 죽으면 Lock이 영원히 풀리지 않는다. 5초 후 자동 해제로 이걸 방지한다. Ch.5에서 Deadlock을 방지하기 위해 타임아웃을 건 것과 같다.


### 해결 2: TTL 분산 (Jitter)

인기 상품 100개의 캐시가 동시에 만료되는 게 문제의 시작이었다. TTL에 랜덤값을 더해서 만료 시점을 흩뿌린다.

```python
import random

def set_cache_with_jitter(key: str, value: str, base_ttl: int = 300):
    # 기본 TTL 300초에 0~60초의 랜덤 오프셋을 추가
    jitter = random.randint(0, 60)
    ttl = base_ttl + jitter
    redis_client.setex(key, ttl, value)
```

100개의 캐시가 전부 300초 TTL이면 동시에 만료된다. 300~360초 사이로 흩뿌리면 만료가 60초에 걸쳐 분산된다. 동시 만료 대신 초당 1~2개씩 만료된다.

간단하지만 효과가 크다. 실무에서 가장 먼저 적용하는 기법이다.


### 해결 3: Probabilistic Early Recomputation

캐시가 만료되기 전에 미리 갱신하는 기법이다. TTL이 남아 있는 상태에서, 만료가 가까워지면 확률적으로 DB를 조회해서 캐시를 갱신한다.

```python
import math

def get_product_early_recompute(product_id: int, beta: float = 1.0):
    cache_key = f"product:{product_id}"

    cached = redis_client.get(cache_key)
    ttl_remaining = redis_client.ttl(cache_key)

    if cached and ttl_remaining > 0:
        # TTL이 충분히 남아있으면 그냥 반환
        # TTL이 적게 남으면 확률적으로 미리 갱신
        # delta = 마지막 DB 조회에 걸린 시간 (여기서는 0.05초로 가정)
        delta = 0.05
        random_value = random.random()
        threshold = delta * beta * math.log(random_value)

        if ttl_remaining + threshold > 0:
            # TTL이 아직 넉넉하거나, 확률적으로 갱신 안 함
            return json.loads(cached)

    # DB 조회 + 캐시 갱신
    product = fetch_product_from_db(product_id)
    redis_client.setex(cache_key, 300, json.dumps(product))
    return product
```

(이 알고리즘은 "Optimal Probabilistic Cache Stampede Prevention" 논문에서 제안됐다. 출처: Vattani, Chakrabarti, Grossman, 2015. "Optimal Probabilistic Cache Stampede Prevention")

핵심 아이디어: TTL이 많이 남았을 때는 거의 모든 요청이 캐시를 그냥 쓴다. TTL이 줄어들수록 "내가 미리 갱신하겠다"고 나서는 요청의 확률이 올라간다. 결과적으로 TTL 만료 직전에 한두 개의 요청이 먼저 DB를 조회해서 캐시를 갱신한다. TTL이 실제로 만료되는 시점에는 이미 새 캐시가 올라와 있다.

### 세 가지 해결책 비교

| 기법 | 구현 난이도 | 효과 | 단점 |
|------|-----------|------|------|
| Mutex Lock | 중간 | DB 조회를 1회로 제한 | Lock 대기 시간 발생, 분산 환경에서 복잡 |
| TTL Jitter | 쉬움 | 동시 만료 방지 | 완전한 방지는 아님 (확률적) |
| Early Recomputation | 어려움 | 만료 자체를 방지 | 구현 복잡, 불필요한 DB 조회 발생 가능 |

실무에서는 TTL Jitter를 기본으로 적용하고, 트래픽이 높은 키에 대해서만 Mutex Lock을 추가하는 조합이 많다. Early Recomputation은 캐시 키 하나의 갱신 비용이 매우 높을 때 (수십 초 걸리는 집계 쿼리 등) 고려한다.

"왜 세 가지를 전부 쓰지 않는가?" 복잡성이 올라간다. 캐시 레이어의 코드가 복잡해지면 그 자체가 버그의 원인이 된다. 간단한 것부터 적용하고, 문제가 생기면 그때 더 강한 기법을 도입하는 게 맞다. 이건 Ch.16에서 "인덱스를 먼저 걸고, 그래도 안 되면 Read Replica, 그래도 안 되면 Sharding"이라고 한 것과 같은 원리다.


### 사례의 핵심 정리

1. 캐시를 붙이는 타이밍은 맞았다. Ch.14와 달리 이번에는 인덱스도 있고 쿼리도 최적화된 상태였다. 트래픽이 DB의 처리 한계를 넘기 때문에 캐시가 필요했다.

2. Cache Stampede는 "정상 상태에서는 안 보이는" 장애다. Hit Rate 99%일 때는 문제가 없다. TTL 만료 순간에만 터진다. 그래서 테스트 환경에서 잡기 어렵다.

3. 해결은 "동시 만료를 방지"하는 것이 핵심이다. TTL Jitter로 만료를 분산시키고, Mutex Lock으로 동시 DB 조회를 제한하고, Early Recomputation으로 만료 자체를 방지한다.

캐시 하나 붙이는 게 이렇게 복잡하다. 그런데 이건 시작일 뿐이다. 캐시를 붙이면 다음 질문이 따라온다. "캐시에 쓰기는 어떻게 하는가?", "캐시가 가득 차면 뭘 지우는가?", "Redis가 죽으면 어떻게 되는가?" 다음에서 캐시 전략을 체계적으로 본다.

---

[< 환경 세팅](./README.md) | [Cache 전략과 설계 >](./02-cache-strategy.md)
