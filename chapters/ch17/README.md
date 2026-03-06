# Ch.17 느리니까 Redis 붙이고 생각해볼까요?

Part 4에서 DB를 깊게 팠다. ORM이 만드는 SQL을 읽고, 인덱스를 이해하고, 트랜잭션과 Isolation Level을 알고, Slow Query를 잡는 법을 배웠다. Part 5는 여기서 한 발 더 나간다. "DB를 최적화했는데도 안 되면 어떻게 하는가?"

Ch.14의 제목이 "인덱스를 안 걸어놓고 Redis를 설치했습니다"였다. Part 4의 교훈은 "DB 자체를 먼저 최적화하라"였다. 이번 챕터부터는 "그래도 안 되면 캐시를 어떻게 쓰는가"를 다룬다.

캐시는 만능이 아니다. 잘못 적용하면 오히려 장애를 유발한다.

---

## 이 챕터에서 다루는 것

- Cache를 붙였는데 오히려 장애가 나는 시나리오 (Cache Stampede)
- Cache-Aside, Write-Through, Write-Back 전략의 차이와 트레이드오프
- Eviction Policy (LRU, LFU)와 TTL 설계
- Redis의 기본 구조와 자료구조
- Cache Stampede 방지 기법 3가지


## 환경

Ch.16에서 사용한 MySQL + SQLAlchemy 환경에 Redis가 추가된다.

| 도구 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 서버 |
| FastAPI | 0.111+ | API 서버 |
| MySQL | 8.0 (Docker) | 원본 데이터 저장소 |
| Redis | 7.x (Docker) | 캐시 저장소 |
| redis-py | 5.x | Python Redis 클라이언트 |
| k6 | 최신 | 부하 테스트 |

### Redis 기동

`docker-compose.yml`에 Redis가 포함되어 있다.

```bash
cd csbe-study && docker compose up -d
```

Redis가 정상적으로 떴는지 확인:

```bash
docker compose exec redis redis-cli ping
# PONG이 나오면 정상
```

(Redis를 왜 쓰는가? 인메모리 Key-Value Store라서 디스크 기반 DB보다 읽기가 수십~수백 배 빠르다. 캐시 용도로 가장 널리 쓰이는 도구다. Memcached도 같은 역할을 하지만, Redis가 자료구조 지원이 더 풍부해서 사실상 표준이 됐다.)

### redis-py 설치

```bash
cd csbe-study && poetry add redis
```

### 서버 실행

```bash
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```


## 목차

1. [사례: Cache를 붙였더니 장애가 났다](./01-case.md)
2. [Cache 전략과 설계](./02-cache-strategy.md)
3. [유사 사례와 키워드 정리](./03-summary.md)

---

다음: [사례: Cache를 붙였더니 장애가 났다 >](./01-case.md)
