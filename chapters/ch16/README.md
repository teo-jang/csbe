# Ch.16 DB 성능 튜닝의 실무

Slow Query 하나가 전체 서비스를 먹통으로 만들 수 있다. 인덱스를 걸었고, 트랜잭션도 이해했고, ORM이 만드는 SQL도 읽을 줄 안다. 그런데 운영 환경에서 DB가 죽는다. 원인은 대부분 Slow Query다.

Ch.13에서 ORM이 만드는 SQL을 읽는 법을, Ch.14에서 인덱스의 원리를, Ch.15에서 트랜잭션과 Isolation Level을 다뤘다. 이번 챕터는 Part 4의 마지막이다. 앞의 세 챕터에서 쌓은 지식을 가지고, 실제 운영 환경에서 DB 성능 문제를 진단하고 해결하는 방법을 다룬다.

---

## 이 챕터에서 다루는 것

- Slow Query가 Connection Pool을 고갈시키는 메커니즘
- Slow Query를 찾는 방법: slow_query_log, Performance Schema
- Connection Pool 사이징 공식
- 서브쿼리 vs JOIN vs EXISTS 성능 차이
- OFFSET Pagination의 함정과 Cursor-based Pagination
- Partitioning, Sharding, Read Replica 개요


## 환경

Ch.6에서 사용한 MySQL + SQLAlchemy 환경과 동일하다. Slow Query Log 설정만 추가한다.

| 도구 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 서버 |
| FastAPI | 0.111+ | API 서버 |
| MySQL | 8.0 (Docker) | Slow Query 재현, EXPLAIN |
| SQLAlchemy + pymysql | 2.0+ | Connection Pool 제어 |
| k6 | 최신 | 부하 테스트 |

### MySQL Slow Query Log 활성화

MySQL 컨테이너에 접속해서 Slow Query Log를 켠다:

```sql
-- Slow Query Log 활성화
SET GLOBAL slow_query_log = 'ON';

-- 1초 이상 걸리는 쿼리를 기록
SET GLOBAL long_query_time = 1;

-- 인덱스를 사용하지 않는 쿼리도 기록
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 설정 확인
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';
```

(재시작하면 초기화된다. 영구 설정은 my.cnf에 넣어야 한다. 실습 용도로는 이걸로 충분하다.)

### 서버 실행

```bash
cd csbe-study && docker compose up -d
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```


## 목차

1. [사례: Slow Query가 서버를 죽인 날](./01-case.md)
2. [쿼리 최적화의 실무](./02-query-optimization.md)
3. [유사 사례와 키워드 정리](./03-summary.md)

---

다음: [사례: Slow Query가 서버를 죽인 날 >](./01-case.md)
