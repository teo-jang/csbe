# Ch.18 Local Cache vs Remote Cache

Ch.17에서 Redis를 다뤘다. Cache-Aside, Write-Through, TTL, Eviction Policy. 캐시를 어떻게 쓰는지, 잘못 쓰면 어떤 장애가 나는지를 확인했다. 그런데 한 가지 빠뜨린 게 있다. 모든 요청이 Redis까지 네트워크를 타야 하는가?

---

## 이 챕터에서 다루는 것

- Local Cache와 Remote Cache의 차이
- CPU Cache에서 배우는 메모리 계층 구조
- 소프트웨어 캐시 계층: Local Cache -> Remote Cache -> DB
- Cache Invalidation 전략 (TTL, Pub/Sub, Write-Through)
- CDN의 역할
- Memcached vs Redis


## 환경

Ch.17에서 사용한 환경에 Python의 cachetools 라이브러리만 추가된다.

| 도구 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 서버 |
| FastAPI | 0.111+ | API 서버 |
| Redis | 7.x (Docker) | Remote Cache |
| cachetools | 5.x | Local Cache (TTLCache, LRUCache) |
| k6 | 최신 | 부하 테스트 |

### cachetools를 쓰는 이유

Python 표준 라이브러리에 `functools.lru_cache`가 있다. 쓸 수 있다. 그런데 두 가지 문제가 있다.

1. TTL을 지원하지 않는다. 한번 캐시된 데이터는 프로세스가 죽을 때까지 남아 있다.
2. 최대 크기를 넘으면 LRU 정책만 쓸 수 있다. LFU나 TTL 기반 정리가 안 된다.

cachetools는 TTLCache(TTL 기반 만료), LRUCache(LRU 기반 교체), LFUCache(LFU 기반 교체)를 제공한다. 실무에서 Local Cache를 쓸 때 거의 항상 TTL이 필요하기 때문에, cachetools가 더 적합하다.

(Java에서는 Caffeine이 같은 역할이다. Go에서는 bigcache나 ristretto가 있다.)

```bash
cd csbe-study && poetry add cachetools
```

### 서버 실행

```bash
cd csbe-study && docker compose up -d
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```


## 목차

1. [사례: 매번 Redis에서 가져온다고?](./01-case.md)
2. [계층 캐시 설계](./02-layered-cache.md)
3. [유사 사례와 키워드 정리](./03-summary.md)

---

다음: [사례: 매번 Redis에서 가져온다고? >](./01-case.md)
