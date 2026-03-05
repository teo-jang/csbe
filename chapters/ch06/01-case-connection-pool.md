# Ch.6 사례: 서버는 살아있는데 요청이 실패한다

[< 환경 세팅](./README.md) | [TCP/IP와 Socket >](./02-tcp-socket.md)

---

Ch.5에서 Race Condition, Deadlock을 다뤘다. 전부 "하나의 서버 안에서" 스레드가 메모리를 공유하면서 생긴 문제였다. 이번에는 서버 밖으로 나간다. 서버가 DB에 연결할 때 무슨 일이 벌어지는가?


## 6-1. 사례 A: Connection Pool이 고갈됐다

개발자가 DB에서 데이터를 조회하는 API를 만들었다. 개발 환경에서 잘 돌아간다. curl로 요청을 보내면 정상 응답이 온다.

부하 테스트를 돌렸다. 동시에 10명이 요청을 보냈다. 서버 프로세스는 살아 있다. MySQL도 정상이다. CPU도 여유 있다. 그런데 일부 요청이 503 에러를 뱉는다.

```
{"error": "connection_pool_exhausted",
 "detail": "TimeoutError: Connection Pool에서 3초 안에 Connection을 확보하지 못했다"}
```

"Connection Pool? 서버도 살아 있고 DB도 살아 있는데, 왜 Connection을 못 잡는 거지?"

이 에러의 원인: Connection Pool의 크기(pool_size=3)보다 동시 요청(10)이 많았다. 3개의 Connection이 전부 사용 중이면, 나머지 7개의 요청은 빈 Connection이 반환될 때까지 기다린다. 3초(pool_timeout) 안에 못 잡으면 에러가 난다.

그러면 Pool 크기를 늘리면 해결되는가? 물론 늘리면 된다. 그런데 한 가지 의문이 생긴다.

"Connection Pool이 뭔데? 왜 Connection을 미리 만들어두는 거지? 매번 새로 만들면 안 되는 건가?"


## 사례 B: 매번 새로 만들면 안 되나?

사례 A의 의문에 답하기 위해, Pool 없이 매 요청마다 Connection을 새로 만드는 방식(NullPool)과, Pool에서 재활용하는 방식(QueuePool)을 비교했다. 같은 쿼리(INSERT + SELECT)를 동일 조건으로 실행했다.


## 6-2. 결과 예측

- "Pool 크기 3인데 동시 10 요청이면, 몇 개가 실패하는가?"
- "매번 새로 만드는 방식과 Pool을 쓰는 방식, 속도 차이가 얼마나 나는가?"
- "새로 만드는 방식에서 Connection을 끊으면 그 Connection은 어디로 가는가?"

<!-- 기대 키워드: Connection Pool, TCP, 3-Way Handshake, Socket, fd, TIME_WAIT -->


## 6-3. 결과 분석

### 사례 A: Pool 고갈

k6로 10 VUs가 각 5번씩 요청을 보냈다. 총 50건. Pool 크기는 3이고, 각 요청은 `SELECT SLEEP(1)`로 1초간 Connection을 점유한다.

| 시나리오 | 총 요청 | 성공 | Pool Exhausted | 평균 응답 시간 |
|----------|---------|------|----------------|--------------|
| QueuePool(size=3) | 50 | 45 | 5 | 1.85s |
| NullPool (Pool 없음) | 50 | 50 | 0 | 1.04s |

측정 환경: M1 Mac, Python 3.12, FastAPI 0.111, uvicorn, MySQL 8.0 (Docker), k6 10 VUs

QueuePool에서 50건 중 5건이 Pool 고갈로 실패했다. Pool에 빈 Connection이 없으면 3초까지 기다리다가 포기한다. 성공한 45건은 순서대로 Connection을 빌려서 정상 처리됐다.

NullPool에서는 50건 전부 성공했다. 매번 새 Connection을 만들어서 Pool 고갈이 없다. 그런데 "그러면 NullPool이 더 좋은 거 아닌가?"

### 사례 B: Pool vs NullPool 성능 비교

같은 쿼리(INSERT + SELECT, SLEEP 없음)를 50 VUs x 10 iterations = 500건씩 보냈다.

| 시나리오 | 총 요청 | 완료 시간 | Throughput | 평균 응답 시간 |
|----------|---------|----------|------------|--------------|
| QueuePool(size=10) | 500 | 0.4초 | ~1,250 req/s | ~39ms |
| NullPool | 500 | 0.7초 | ~714 req/s | ~62ms |

측정 환경: M1 Mac, Python 3.12, FastAPI 0.111, uvicorn, MySQL 8.0 (Docker), k6 50 VUs

QueuePool이 NullPool보다 약 1.75배 빠르다. localhost에서 이 정도면, 네트워크 지연이 있는 실제 환경에서는 차이가 훨씬 커진다.

(실제 운영 환경에서 DB가 별도 서버에 있으면, Connection 하나를 만드는 데 TCP 3-Way Handshake + MySQL 인증까지 수ms~수십ms가 든다. 500건이면 그게 누적된다.)

### TIME_WAIT: NullPool의 숨은 비용

NullPool 벤치마크 직후 `netstat`으로 Connection 상태를 확인했다:

```
$ netstat -an | grep 3306 | grep TIME_WAIT | wc -l
503
```

503개의 TIME_WAIT 상태 Connection. NullPool은 매 요청마다 Connection을 만들고 즉시 닫는다. 닫힌 Connection은 TIME_WAIT 상태로 수십 초간 남아 있다 (OS마다 다름. Linux 약 60초, macOS 약 30초). 이게 수백 개 쌓이면? 사용 가능한 로컬 포트가 고갈될 수 있다.

QueuePool은 Connection을 재활용하니까 TIME_WAIT가 거의 발생하지 않는다.

정리하면:

| | QueuePool | NullPool |
|--|-----------|----------|
| 속도 | 빠르다 (Connection 재활용) | 느리다 (매번 새로 만듦) |
| Pool 고갈 | 가능 (크기 제한) | 없음 |
| TIME_WAIT | 거의 없음 | 대량 발생 |
| 포트 고갈 위험 | 없음 | 있음 |

Pool이 없으면 느리고, Pool이 있으면 고갈될 수 있다. 이 딜레마를 해결하려면 Connection이 대체 뭔지, 왜 만드는 데 비용이 드는지를 알아야 한다.


## 6-4. 코드 설명

서버 코드의 핵심은 SQLAlchemy 엔진 설정이다.

### Pool 고갈을 재현하는 엔진

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

# pool_size=3: 최대 3개 Connection만 유지
# max_overflow=0: 추가 생성 불가
# pool_timeout=3: 3초 안에 못 잡으면 에러
_small_pool_engine = create_engine(
    "mysql+pymysql://root:csbe@localhost:3306/csbe_study",
    pool_size=3,
    max_overflow=0,
    pool_timeout=3,
    poolclass=QueuePool,
)
```

`pool_size=3, max_overflow=0`이면 동시에 3개까지만 Connection을 사용할 수 있다. 4번째 요청부터는 빈 Connection이 반환될 때까지 대기한다.

### NullPool 엔진

```python
from sqlalchemy.pool import NullPool

# Pool이 없다. 매 요청마다 새 Connection을 만들고 즉시 닫는다
_nopool_engine = create_engine(
    "mysql+pymysql://root:csbe@localhost:3306/csbe_study",
    poolclass=NullPool,
)
```

NullPool은 "Pool이 없는 Pool"이다. `connect()`를 호출할 때마다 TCP Connection을 새로 만들고, `close()`하면 즉시 끊는다.

### Pool 고갈 유발 엔드포인트

```python
@router.post("/pool/query-pool")
def query_with_pool():
    try:
        with _small_pool_engine.connect() as conn:
            conn.execute(text("SELECT SLEEP(1)"))  # 1초간 Connection 점유
            result = conn.execute(text("SELECT 1 AS alive"))
            return {"result": "success", "data": result.fetchone()[0]}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"error": "connection_pool_exhausted", ...},
        )
```

`SELECT SLEEP(1)`이 핵심이다. 1초간 Connection을 잡고 있으니까, 3개의 Connection이 전부 SLEEP 중이면 나머지 요청은 대기한다. 3초 안에 못 잡으면 `TimeoutError`가 발생하고, 503을 반환한다.

(실제 서비스에서는 SLEEP이 아니라 "느린 쿼리"가 이 역할을 한다. Slow Query가 Connection을 오래 잡고 있으면 같은 현상이 생긴다. Ch.16에서 자세히 다룬다.)

한 가지 주의할 점: 이 엔드포인트는 `def`(동기 함수)로 작성했다. `async def`로 바꾸면 안 된다. Ch.3에서 "CPU Bound 작업을 async로 하면 오히려 느려진다"고 했는데, 동기 SQLAlchemy(`pymysql`)의 DB 호출도 마찬가지다. `async def` 안에서 동기 DB 호출을 하면 이벤트 루프 자체가 블로킹된다. FastAPI는 `def` 함수를 별도 스레드에서 실행하므로, 동기 SQLAlchemy를 쓸 때는 `def`가 맞다.

### k6 테스트 스크립트

```javascript
export const options = {
    scenarios: {
        pool_test: {
            executor: 'per-vu-iterations',
            vus: 10,          // 동시 10명
            iterations: 5,     // 각 5번
            exec: 'poolTest',
        },
    },
};

export function poolTest() {
    http.post(`${BASE_URL}/pool/query-pool`, null, {
        timeout: '10s',
    });
}
```

10 VUs가 동시에 `query-pool`을 호출한다. Pool 크기(3)를 초과하는 동시 요청이 발생하면서 일부가 실패한다.

왜 Connection을 새로 만드는 게 비싸고, Pool로 재활용하는 게 왜 필요한지, 다음에서 본다.

---

[< 환경 세팅](./README.md) | [TCP/IP와 Socket >](./02-tcp-socket.md)
