# Ch.17 Cache 전략과 설계

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 Cache-Aside 패턴으로 캐시를 붙였더니 Cache Stampede가 터진 걸 확인했다. 해결 기법도 봤다. 이번에는 캐시 전략을 체계적으로 본다. 읽기 캐시만 있는 게 아니다. 쓰기 캐시도 있고, 캐시가 가득 찼을 때의 정책도 있고, Redis 자체의 특성도 알아야 한다.


## 캐시 쓰기 전략 3가지

캐시에 데이터를 읽어오는 패턴은 앞에서 봤다 (Cache-Aside). 그런데 데이터가 변경되면 어떻게 하는가? 원본(DB)과 캐시(Redis)에 모두 반영해야 한다. 이걸 처리하는 전략이 세 가지다.


### Cache-Aside (Lazy Loading)

앞의 사례에서 쓴 패턴이다. 읽기와 쓰기를 따로 처리한다.

```
읽기: 캐시 확인 → Miss면 DB 조회 → 캐시 저장
쓰기: DB 업데이트 → 캐시 삭제 (또는 갱신)
```

```python
# 읽기
async def get_product(product_id: int):
    cache_key = f"product:{product_id}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    product = fetch_product_from_db(product_id)
    redis_client.setex(cache_key, 300, json.dumps(product))
    return product

# 쓰기
async def update_product(product_id: int, data: dict):
    update_product_in_db(product_id, data)
    redis_client.delete(f"product:{product_id}")  # 캐시 삭제
```

<details>
<summary>Cache-Aside (캐시 어사이드)</summary>

애플리케이션이 캐시와 DB를 직접 관리하는 패턴이다. "Lazy Loading"이라고도 한다. 캐시에 데이터가 없을 때만 DB에서 가져와서 캐시에 넣으니까 "게으른 로딩"이다. 가장 보편적인 캐시 패턴이고, 대부분의 캐시 도입은 이 패턴에서 시작한다.

장점: 실제로 요청되는 데이터만 캐시에 올라간다. 안 쓰는 데이터로 캐시가 차지 않는다.
단점: 첫 번째 요청은 반드시 Cache Miss가 발생한다 (Cold Start). Cache Stampede에 취약하다.

</details>

쓰기 시에 "캐시를 삭제"하는 이유가 있다. "캐시를 갱신"하면 안 되는가? 되긴 된다. 하지만 삭제가 더 안전하다. 캐시 갱신은 "DB 업데이트 + 캐시 갱신" 두 연산이 모두 성공해야 한다. DB는 성공했는데 캐시 갱신에 실패하면? DB와 캐시가 불일치한다. 삭제하면 다음 읽기에서 자연스럽게 DB 데이터가 캐시에 올라온다.

(이걸 "Cache Invalidation"이라고 한다. Phil Karlton의 유명한 말이 있다. "컴퓨터 과학에서 어려운 것은 딱 두 가지다. 캐시 무효화와 이름 짓기." 캐시 무효화가 어려운 이유를 이 챕터에서 체감하게 된다.)


### Write-Through

쓰기 시에 캐시와 DB를 동시에 업데이트한다.

```
읽기: 캐시 확인 → Miss면 DB 조회 → 캐시 저장
쓰기: 캐시 업데이트 → DB 업데이트 (순서 중요)
```

```python
async def update_product_write_through(product_id: int, data: dict):
    # 캐시와 DB를 동시에 업데이트
    product = {**data, "id": product_id}
    redis_client.setex(f"product:{product_id}", 300, json.dumps(product))
    update_product_in_db(product_id, data)
```

<details>
<summary>Write-Through (라이트 스루)</summary>

모든 쓰기가 캐시를 거쳐서 DB에 반영되는 패턴이다. 캐시와 DB가 항상 동기화 상태를 유지한다. 읽기 시 캐시에 항상 최신 데이터가 있으니 Cache Miss가 줄어든다.

장점: 캐시와 DB의 일관성이 높다. 읽기 성능이 좋다.
단점: 쓰기가 느려진다. 모든 쓰기에 캐시 + DB 두 번의 쓰기가 필요하다. 한 번도 읽히지 않는 데이터도 캐시에 올라간다.

(Java Spring의 `@CachePut` 어노테이션이 Write-Through 패턴을 구현한다. Python에서는 직접 구현해야 한다.)

</details>

Write-Through의 문제: 쓰기 지연이 생긴다. 캐시에 쓰고 DB에도 써야 하니까 쓰기 레이턴시가 늘어난다. 그리고 쓰기만 하고 읽히지 않는 데이터도 캐시에 올라간다. 메모리 낭비다. 쓰기 빈도가 높은 서비스에서는 적합하지 않다.


### Write-Back (Write-Behind)

캐시에만 쓰고, DB에는 나중에 비동기로 반영한다.

```
읽기: 캐시 확인 → Miss면 DB 조회 → 캐시 저장
쓰기: 캐시에만 쓴다 → 나중에 배치로 DB에 반영
```

```python
# 쓰기: 캐시에만 저장 (빠르다)
async def update_product_write_back(product_id: int, data: dict):
    product = {**data, "id": product_id}
    redis_client.setex(f"product:{product_id}", 300, json.dumps(product))
    # DB에는 안 쓴다. 나중에 별도 프로세스가 처리한다.

# 별도 배치 프로세스: 캐시의 변경사항을 DB에 반영
async def flush_cache_to_db():
    # 변경된 캐시 키 목록을 읽어서 DB에 반영
    dirty_keys = redis_client.smembers("dirty_products")
    for key in dirty_keys:
        product_data = redis_client.get(key)
        if product_data:
            product = json.loads(product_data)
            update_product_in_db(product["id"], product)
    redis_client.delete("dirty_products")
```

<details>
<summary>Write-Back / Write-Behind (라이트 백)</summary>

쓰기를 캐시에만 하고, 원본 저장소(DB)에는 나중에 비동기로 반영하는 패턴이다. 쓰기 성능이 매우 빠르다. 캐시에 쓰는 건 메모리 연산이니까 마이크로초 단위다.

장점: 쓰기가 극도로 빠르다. DB 부하가 줄어든다. 여러 번의 쓰기를 모아서 한 번에 DB에 반영할 수 있다 (Write Coalescing).
단점: 캐시에만 있고 DB에 아직 반영 안 된 데이터가 유실될 수 있다. Redis가 죽으면 그 사이의 데이터가 날아간다.

CPU Cache가 RAM에 쓰는 방식이 바로 Write-Back이다. CPU는 Cache Line에 쓰고, 해당 Line이 교체될 때 RAM에 반영한다. Ch.18에서 CPU Cache와 애플리케이션 캐시의 유사점을 다룬다.

</details>

Write-Back의 치명적인 단점: 데이터 유실 위험이 있다. Redis에만 쓰고 DB에 아직 반영하지 않은 상태에서 Redis가 죽으면? 그 데이터는 사라진다. 상품 가격이나 재고처럼 유실되면 안 되는 데이터에는 쓰면 안 된다. 로그, 조회수, 좋아요 수처럼 "유실돼도 치명적이지 않은" 데이터에 적합하다.


### 세 가지 전략 비교

| 전략 | 읽기 성능 | 쓰기 성능 | 일관성 | 데이터 유실 위험 | 적합한 경우 |
|------|----------|----------|--------|----------------|------------|
| Cache-Aside | 첫 요청 느림 (Cold Start) | DB 직접 쓰기 | 삭제 후 재로딩 | 없음 | 대부분의 경우 |
| Write-Through | 항상 빠름 | 느림 (이중 쓰기) | 높음 | 없음 | 읽기 >> 쓰기인 경우 |
| Write-Back | 항상 빠름 | 매우 빠름 | 지연 반영 | 있음 | 쓰기 빈도 높고, 유실 허용 가능한 경우 |

대부분의 웹 서비스에서는 Cache-Aside를 기본으로 쓴다. Write-Through는 "쓰기 직후 바로 읽기"가 빈번한 경우 (사용자 프로필 등), Write-Back은 카운터나 통계 데이터에 제한적으로 쓴다.

여기까지가 "캐시에 어떻게 쓰는가"다. 그런데 캐시에 쓰다 보면 결국 캐시가 가득 찬다. 메모리는 유한하다. 가득 차면 뭘 지워야 한다.


## Eviction Policy: 캐시가 가득 차면 뭘 지우는가

Redis의 메모리에는 한계가 있다. `maxmemory` 설정으로 상한을 정하고, 상한에 도달하면 Eviction Policy에 따라 기존 데이터를 삭제한다.

<details>
<summary>Eviction Policy (퇴거 정책)</summary>

캐시 메모리가 가득 찼을 때 어떤 데이터를 삭제할지 결정하는 규칙이다. "한정된 공간에서 뭘 버릴 것인가"의 문제다. 잘못 선택하면 자주 쓰는 데이터가 삭제돼서 Cache Hit Rate가 급락한다.

운영체제의 Page Replacement 알고리즘과 같은 원리다. Ch.4에서 다뤘던 Physical Memory가 가득 찼을 때 어떤 Page를 내보낼 것인가의 문제와 구조가 동일하다.

</details>

### LRU (Least Recently Used)

가장 오래 전에 사용된 데이터를 삭제한다.

```
시간 흐름 →
접근: A B C D E A B F
캐시 (크기 4): [A B C D] → [B C D E] → [C D E A] → [D E A B] → [E A B F]
```

"최근에 안 쓰인 데이터는 앞으로도 안 쓰일 가능성이 높다"는 가정이다. 대부분의 웹 서비스에서 잘 동작한다. Redis의 기본 Eviction Policy도 LRU 계열이다.

<details>
<summary>LRU (Least Recently Used)</summary>

가장 오랫동안 접근되지 않은 데이터를 제거하는 알고리즘이다. "최근에 쓴 건 곧 또 쓸 가능성이 높다"는 시간적 지역성(Temporal Locality) 원리에 기반한다. 구현은 보통 HashMap + Doubly Linked List 조합이다. 접근할 때마다 해당 항목을 리스트의 맨 앞으로 옮기고, 공간이 부족하면 맨 뒤(가장 오래된 것)를 삭제한다.

Python의 `collections.OrderedDict`가 LRU Cache의 기반 자료구조로 자주 사용된다. `functools.lru_cache`가 내부적으로 비슷한 구조를 쓴다.

</details>


### LFU (Least Frequently Used)

가장 적게 사용된 데이터를 삭제한다.

```
접근 횟수: A(100번) B(2번) C(50번) D(1번)
삭제 대상: D (1번) → B (2번) → ...
```

"많이 쓰인 데이터는 앞으로도 많이 쓰일 가능성이 높다"는 가정이다. 인기 상품처럼 특정 데이터에 접근이 집중되는 패턴에서 LRU보다 효과적이다.

<details>
<summary>LFU (Least Frequently Used)</summary>

접근 빈도가 가장 낮은 데이터를 제거하는 알고리즘이다. LRU가 "언제 접근했는가"를 보는 반면, LFU는 "몇 번 접근했는가"를 본다.

단점: 과거에 많이 접근했지만 지금은 안 쓰이는 데이터가 계속 남는다. 예를 들어 작년 블랙프라이데이에 100만 번 조회된 상품이 올해는 1번도 안 조회돼도 캐시에 남아있을 수 있다. 이걸 "Cache Pollution"이라고 한다. Redis의 LFU 구현은 접근 빈도를 시간에 따라 감쇠시키는 방식으로 이 문제를 완화한다.

</details>

### Redis의 maxmemory-policy

Redis 설정에서 Eviction Policy를 지정한다.

```
# redis.conf 또는 런타임 설정
maxmemory 1gb
maxmemory-policy allkeys-lru
```

주요 옵션:

| 정책 | 동작 | 적합한 경우 |
|------|------|------------|
| noeviction | 메모리 가득 차면 쓰기 거부 (에러) | 캐시가 아닌 데이터 저장소로 쓸 때 |
| allkeys-lru | 모든 키 중 LRU로 삭제 | 가장 일반적인 캐시 용도 |
| allkeys-lfu | 모든 키 중 LFU로 삭제 | 특정 키에 접근이 집중되는 경우 |
| volatile-lru | TTL 설정된 키 중 LRU로 삭제 | TTL 있는 캐시와 영구 데이터가 혼재된 경우 |
| volatile-ttl | TTL이 가장 짧게 남은 키부터 삭제 | TTL 기반으로 우선순위를 두는 경우 |

(출처: Redis 공식 문서, "Using Redis as an LRU cache", redis.io/docs/reference/eviction)

실무에서는 `allkeys-lru`를 기본으로 쓴다. 특별한 이유가 없으면 이걸로 시작하고, 모니터링하면서 조정한다.


## TTL 설계

TTL이 캐시의 수명을 결정한다. 이걸 잘못 잡으면 두 가지 문제가 생긴다.

### TTL이 너무 짧으면

Cache Miss가 잦아진다. 5초 TTL이면 5초마다 DB를 때린다. 트래픽이 높으면 캐시의 의미가 없어진다. Hit Rate가 떨어진다.

### TTL이 너무 길면

원본 데이터와의 불일치 시간이 길어진다. 상품 가격을 바꿨는데 30분간 옛날 가격이 보인다. 캐시를 명시적으로 삭제하면 해결되지만, 삭제 로직을 빠뜨리면 불일치가 TTL만큼 지속된다.

### 데이터 성격별 TTL 가이드

| 데이터 | TTL | 이유 |
|--------|-----|------|
| 상품 상세 (가격, 설명) | 5~10분 | 자주 안 바뀜, 바뀌면 즉시 무효화 |
| 사용자 프로필 | 10~30분 | 자주 안 바뀜 |
| 검색 결과 | 1~5분 | 실시간성이 중요 |
| 인기 상품 랭킹 | 1~5분 | 자주 바뀌지만 약간의 지연 허용 |
| 설정값 (Config) | 1~24시간 | 거의 안 바뀜, 변경 시 수동 무효화 |
| 세션 정보 | 30분~수 시간 | 세션 만료 정책에 맞춤 |

이건 가이드일 뿐이다. 정답은 "서비스 요구사항"에 달려 있다. "이 데이터가 5분 동안 오래된 상태여도 괜찮은가?" 이 질문에 답할 수 있으면 TTL이 정해진다.


## Redis 기본 구조

Redis의 핵심 특성을 알아야 캐시 설계가 가능하다.

<details>
<summary>Redis</summary>

Remote Dictionary Server의 약자다. 인메모리 Key-Value 저장소다. 데이터를 디스크가 아니라 메모리에 저장하기 때문에 읽기/쓰기가 마이크로초 단위로 빠르다.

핵심 특징:
- 인메모리: RAM에 저장. 디스크 I/O가 없다.
- 싱글 스레드: 명령어를 하나씩 순서대로 처리한다. 동시성 문제가 없다. SET NX가 원자적인 이유다.
- 다양한 자료구조: String, Hash, List, Set, Sorted Set 등을 네이티브로 지원한다.
- 영속성 옵션: RDB 스냅샷, AOF(Append Only File)로 디스크에 백업할 수 있다. 캐시 용도로 쓸 때는 보통 끈다.

(출처: Redis 공식 문서, redis.io/docs)

(Python에서는 `redis-py` 라이브러리를 쓴다. Java에서는 Jedis나 Lettuce, Go에서는 `go-redis`가 대표적이다.)

</details>

### 싱글 스레드인데 왜 빠른가?

자주 나오는 질문이다. "멀티 스레드가 더 빠른 거 아닌가?"

아니다. Redis가 하는 일은 메모리에서 데이터를 읽고 쓰는 거다. 이건 CPU Bound가 아니라 I/O Bound도 아닌, 순수 메모리 연산이다. 나노초 단위다. 여기에 멀티 스레드를 도입하면 Lock 경합, Context Switch 오버헤드가 생긴다. Ch.3에서 "모든 작업을 async로 바꾸면 빨라지는 게 아니다"라고 했다. Redis도 마찬가지다. 순수 메모리 연산에는 싱글 스레드가 오히려 빠르다.

(Redis 6.0부터 I/O 멀티플렉싱에 스레드를 활용하기 시작했다. 하지만 명령어 실행 자체는 여전히 싱글 스레드다. 이건 네트워크 I/O를 병렬화한 거지, 데이터 처리를 병렬화한 게 아니다.)

병목은 네트워크다. 클라이언트에서 Redis까지의 네트워크 왕복 시간(RTT)이 보통 0.1~1ms다. Redis의 명령 처리 시간은 마이크로초 단위이니까, 실제 응답 시간의 대부분은 네트워크 지연이다.


### Redis 자료구조

캐시 용도로 자주 쓰는 자료구조를 간략히 본다.

| 자료구조 | 용도 | 예시 |
|----------|------|------|
| String | 단순 Key-Value | 상품 상세 JSON, 세션 데이터 |
| Hash | 필드별 접근이 필요한 객체 | 사용자 프로필 (name, email 개별 접근) |
| List | 순서 있는 목록 | 최근 조회 상품 목록, 알림 큐 |
| Set | 중복 없는 집합 | 좋아요 누른 사용자 ID 목록 |
| Sorted Set | 점수 기반 정렬 | 실시간 랭킹, 리더보드 |

String이 가장 많이 쓰인다. 상품 상세 같은 걸 JSON으로 직렬화해서 String으로 저장하는 게 가장 단순한 캐시 패턴이다.

```python
# String으로 캐싱
redis_client.setex("product:123", 300, json.dumps(product_dict))
product = json.loads(redis_client.get("product:123"))

# Hash로 캐싱 (필드별 접근이 필요할 때)
redis_client.hset("user:456", mapping={"name": "홍길동", "email": "hong@example.com"})
name = redis_client.hget("user:456", "name")  # name만 가져온다
```

Hash를 쓰면 전체 객체를 읽지 않고 필요한 필드만 가져올 수 있다. 네트워크 전송량이 줄어든다. 하지만 TTL을 필드 단위로 설정할 수 없다 (키 단위로만 가능). 트레이드오프다.


### Redis가 죽으면 어떻게 되는가?

캐시용 Redis가 죽으면? 모든 요청이 DB로 간다. Cache Stampede가 전체 키에 대해 동시에 발생하는 셈이다. DB가 이걸 감당할 수 있어야 한다.

이걸 대비하는 방법:

1. Redis Sentinel 또는 Redis Cluster로 고가용성을 확보한다. Master가 죽으면 Slave가 자동으로 승격한다.
2. 애플리케이션에서 Redis 장애 시 DB로 Fallback하는 코드를 넣는다. try/except로 Redis 에러를 잡고, DB 직접 조회로 전환한다.
3. DB 자체가 캐시 없이도 버틸 수 있는 용량을 확보한다. 캐시는 "성능 향상"이지 "필수 의존성"이 되면 안 된다.

```python
async def get_product_with_fallback(product_id: int):
    try:
        cached = redis_client.get(f"product:{product_id}")
        if cached:
            return json.loads(cached)
    except redis.ConnectionError:
        # Redis 장애 시 DB로 바로 간다
        pass

    return fetch_product_from_db(product_id)
```

(3번이 핵심이다. Redis를 "있으면 좋고, 없어도 서비스는 돌아가는" 레이어로 설계해야 한다. Redis가 죽으면 서비스가 죽는 구조라면, Redis가 단일 장애점(Single Point of Failure)이 된 거다.)

여기까지가 캐시 전략의 기본이다. Cache-Aside, Write-Through, Write-Back으로 읽기/쓰기를 처리하고, LRU/LFU로 메모리를 관리하고, TTL로 데이터 수명을 정하고, Redis의 특성을 이해한다.

그런데 이건 전부 "Remote Cache" 이야기다. 모든 요청이 Redis까지 네트워크를 타야 한다. "이 데이터를 굳이 Redis까지 갈 필요가 있는가? 서버 메모리에 들고 있으면 안 되는가?" 이 질문은 Ch.18에서 다룬다.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
