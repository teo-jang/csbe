# Ch.16 사례: Slow Query가 서버를 죽인 날

[< 환경 세팅](./README.md) | [쿼리 최적화 >](./02-query-optimization.md)

---

앞에서 인덱스의 원리, ORM이 만드는 SQL, 트랜잭션과 Isolation Level을 다뤘다. 이번에는 그 모든 지식이 결합되는 실무 시나리오다. Slow Query 하나가 전체 서비스를 어떻게 먹통으로 만드는지.


## 16-1. 사례 설명

2년차 백엔드 개발자가 주문 내역 조회 API를 만들었다. 개발 환경에서 잘 돌아간다. 데이터가 1,000건이니까 당연하다. 운영에 배포했다. 주문 테이블에 500만 건이 쌓여 있다.

평소에는 문제없다. 그런데 매일 오후 2시~3시 사이에 서버가 먹통이 된다. API 응답이 안 온다. 서버 프로세스는 살아 있다. MySQL도 살아 있다. CPU도 여유 있다. 그런데 모든 요청이 타임아웃이다.

```
{"error": "connection_pool_exhausted",
 "detail": "TimeoutError: Connection Pool에서 30초 안에 Connection을 확보하지 못했다"}
```

Ch.6에서 봤던 에러다. Connection Pool이 고갈됐다.

그런데 이번에는 상황이 다르다. Ch.6에서는 "동시 요청 수 > pool_size"가 원인이었다. 이번에는 동시 요청이 10개도 안 된다. pool_size는 10이다. 왜 고갈되는가?

원인을 찾기 위해 MySQL의 `SHOW PROCESSLIST`를 실행했다:

```sql
mysql> SHOW PROCESSLIST;
+----+------+-----------+------------+---------+------+----------+-------------------------------------------+
| Id | User | Host      | db         | Command | Time | State    | Info                                      |
+----+------+-----------+------------+---------+------+----------+-------------------------------------------+
| 15 | root | 10.0.0.1  | csbe_study | Query   |   45 | Sending  | SELECT o.*, u.name, p.title FROM orders o |
| 16 | root | 10.0.0.1  | csbe_study | Query   |   38 | Sending  | SELECT o.*, u.name, p.title FROM orders o |
| 17 | root | 10.0.0.1  | csbe_study | Query   |   32 | Sending  | SELECT o.*, u.name, p.title FROM orders o |
| 18 | root | 10.0.0.1  | csbe_study | Query   |   27 | Sending  | SELECT o.*, u.name, p.title FROM orders o |
| ...                                                                                                       |
+----+------+-----------+------------+---------+------+----------+-------------------------------------------+
```

같은 쿼리가 여러 개 동시에 돌고 있다. Time 컬럼을 보면 45초, 38초, 32초... 전부 수십 초째 실행 중이다. 하나의 쿼리가 수십 초간 Connection을 점유하니까, pool_size=10이어도 10개의 Connection이 전부 이 쿼리에 잡혀 있다. 새로운 요청이 들어와도 빈 Connection이 없다.

문제의 쿼리를 뜯어봤다:

```sql
SELECT o.*, u.name, p.title
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.id
WHERE o.created_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 99980;
```

orders 테이블 500만 건에 인덱스 없이 날짜 범위 검색 + JOIN + OFFSET 99980. 이게 매번 수십 초 걸린다.

오후 2시~3시에 장애가 나는 이유? 그 시간대에 운영팀이 "이번 달 주문 내역"을 엑셀로 뽑는다. 뒤쪽 페이지까지 넘기면서. 한 명이 이 쿼리를 실행하면 Connection 하나가 수십 초간 잡힌다. 운영팀 3명이 동시에 하면 3개. 거기에 일반 사용자 요청이 겹치면? 10개 Connection이 전부 소진된다.

이 에피소드에서 중요한 건 "Slow Query 하나가 서비스 전체를 먹통으로 만들 수 있다"는 점이다. 서버가 죽은 게 아니다. DB가 죽은 것도 아니다. Connection이 반환되지 않아서 다른 모든 요청이 대기하다가 타임아웃 난 거다.


## 16-2. 결과 예측

- 이 쿼리가 왜 느린가? 원인이 몇 가지인가?
- `OFFSET 99980`이 왜 문제인가?
- Connection Pool 크기를 늘리면 해결되는가?
- 서버를 3대로 늘리면?

<!-- 기대 키워드: Slow Query, Full Table Scan, Connection Pool, OFFSET, Cursor-based Pagination, EXPLAIN -->


## 16-3. 결과 분석

이 쿼리가 느린 이유는 하나가 아니라 세 가지가 겹쳐 있다.

### 원인 1: created_at에 인덱스가 없다

`WHERE o.created_at BETWEEN ...`이 Full Table Scan을 유발한다. 500만 건을 처음부터 끝까지 읽으면서 날짜 범위에 해당하는 행을 찾는다.

```sql
EXPLAIN SELECT o.*, u.name, p.title
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.id
WHERE o.created_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 99980;
```

```
+----+-------+------+------+---------+------+----------+-------------------------------+
| id | table | type | key  | key_len | rows | filtered | Extra                         |
+----+-------+------+------+---------+------+----------+-------------------------------+
|  1 | o     | ALL  | NULL | NULL    | 5000000 | 11.11 | Using where; Using filesort   |
|  1 | u     | ALL  | NULL | NULL    |  100000 | 10.00 | Using where; Using join buffer|
|  1 | p     | ALL  | NULL | NULL    |   50000 | 10.00 | Using where; Using join buffer|
+----+-------+------+------+---------+------+----------+-------------------------------+
```

`type: ALL` -- 세 테이블 전부 Full Table Scan이다. `Using filesort`는 정렬을 메모리가 아니라 디스크에서 한다는 뜻이다. 데이터가 sort_buffer_size보다 크면 임시 파일을 만들어서 정렬한다.

<details>
<summary>Slow Query (슬로우 쿼리)</summary>

실행 시간이 일정 기준(보통 1초)을 초과하는 SQL 쿼리다. MySQL에서는 `slow_query_log`를 켜면 이 기준을 넘는 쿼리를 파일에 기록한다. Slow Query 자체가 문제인 것도 있지만, 진짜 위험한 건 Slow Query가 Connection을 오래 잡고 있으면서 Connection Pool을 고갈시키는 거다.

</details>

### 원인 2: OFFSET이 크다

`LIMIT 20 OFFSET 99980`은 "100,000번째 행부터 20개를 줘"라는 뜻이다. DB는 이걸 어떻게 처리하는가?

1. 조건에 맞는 행을 찾는다
2. 정렬한다
3. 앞에서 99,980개를 건너뛴다
4. 20개를 반환한다

문제는 3번이다. "건너뛴다"가 "안 읽는다"가 아니다. 99,980개를 읽고 버린다. OFFSET이 커질수록 읽고 버리는 행이 많아진다. 페이지를 뒤로 갈수록 느려지는 이유다.

| OFFSET | 읽는 행 수 | 반환하는 행 수 | 낭비 |
|--------|-----------|--------------|------|
| 0 | 20 | 20 | 0% |
| 1,000 | 1,020 | 20 | 98% |
| 10,000 | 10,020 | 20 | 99.8% |
| 99,980 | 100,000 | 20 | 99.98% |

OFFSET 99,980이면 100,000개를 읽어서 20개만 쓴다. 나머지 99,980개는 버린다.

<details>
<summary>OFFSET Pagination</summary>

`LIMIT N OFFSET M` 방식의 페이지네이션이다. 구현이 단순해서 많이 쓰이지만, 뒤쪽 페이지로 갈수록 성능이 급격히 떨어지는 치명적인 단점이 있다. DB가 OFFSET만큼의 행을 실제로 읽은 뒤 버려야 하기 때문이다. "5,000페이지 중 4,999페이지"를 누가 보겠느냐고 생각할 수 있지만, 내부 관리 도구나 배치 작업에서는 실제로 이런 요청이 발생한다.

</details>

### 원인 3: SELECT *

`SELECT o.*`는 orders 테이블의 모든 컬럼을 가져온다. 필요한 건 id, created_at, user_name, product_title 정도인데, 주문 상세 JSON, 배송 메모, 내부 메타데이터까지 전부 끌고 온다. 행 하나의 크기가 커지면 디스크 I/O가 늘어나고, 네트워크 전송량도 늘어난다.

### 세 가지를 겹치면

| 원인 | 단독 영향 | 겹쳤을 때 |
|------|----------|----------|
| Full Table Scan (인덱스 없음) | 500만 건 순회 | 500만 건 순회 |
| OFFSET 99,980 | 10만 행 읽고 버림 | Full Scan 결과에서 10만 행 읽고 버림 |
| SELECT * | 행당 데이터 크기 증가 | 10만 행 x 큰 행 크기 = 대량 I/O |

하나만 있어도 느린데 세 개가 겹치면 수십 초가 된다.

### Connection Pool 크기를 늘리면?

pool_size를 10에서 50으로 늘리면? Slow Query는 여전히 수십 초다. 50개의 Connection이 전부 Slow Query에 잡히는 데 시간이 좀 더 걸릴 뿐이다. 근본적인 해결이 아니다.

더 나쁜 시나리오: "서버가 느리니까 서버를 3대로 늘리자." 서버 3대 x pool_size 50 = 150개의 Connection이 MySQL에 붙는다. MySQL의 `max_connections` 기본값은 151이다. Connection Pool이 DB의 max_connections를 초과하면 DB 자체가 Connection을 거부한다. 서버를 늘렸더니 오히려 장애가 커진다.

기본 공식을 다시 떠올려보면:

```
서버 대수 x (pool_size + max_overflow) < DB max_connections
```

Ch.6에서 다뤘던 이 공식이다. pool_size를 무작정 늘리면 안 되는 이유가 여기에 있다.

<details>
<summary>Connection Pool 사이징</summary>

Connection Pool 크기를 결정하는 건 "크면 좋다"가 아니다. Pool이 너무 작으면 요청이 대기하고, 너무 크면 DB에 부하가 간다. 핵심 공식은 `서버 대수 x (pool_size + max_overflow) < DB max_connections`이다. 여기에 모니터링 도구, 배치 작업, 관리자 접속 등을 위한 여유분(보통 20~30%)을 빼야 한다. HikariCP(Java)의 권장 공식은 `pool_size = (core_count * 2) + effective_spindle_count`인데, SSD 환경에서는 core_count * 2 정도로 시작해서 부하 테스트로 조정하는 게 현실적이다.

(출처: HikariCP Wiki, "About Pool Sizing", https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

</details>


## 16-4. Slow Query 찾는 법

쿼리가 느린 건 알겠다. 그런데 운영 환경에서 "어떤 쿼리가 느린지"를 어떻게 찾는가?

### 방법 1: slow_query_log

MySQL의 Slow Query Log는 `long_query_time`을 초과하는 쿼리를 파일에 기록한다.

```sql
-- 현재 설정 확인
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';

-- 활성화 (런타임)
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 1초 이상 걸리는 쿼리 기록
```

기록되는 내용:

```
# Time: 2024-07-15T14:23:45.123456Z
# User@Host: root[root] @ 10.0.0.1
# Query_time: 45.234  Lock_time: 0.001  Rows_sent: 20  Rows_examined: 5000000
SET timestamp=1721052225;
SELECT o.*, u.name, p.title FROM orders o ...
```

`Rows_examined: 5000000` -- 20개를 반환하기 위해 500만 행을 읽었다. 이 비율이 비정상이다.

`mysqldumpslow` 명령으로 가장 느린 쿼리 Top 10을 뽑을 수 있다:

```bash
mysqldumpslow -s t -t 10 /var/lib/mysql/slow-query.log
```

### 방법 2: Performance Schema

MySQL 5.6+에서는 Performance Schema로 실시간 쿼리 통계를 볼 수 있다.

```sql
-- 가장 오래 걸리는 쿼리 Top 5
SELECT
    DIGEST_TEXT,
    COUNT_STAR AS exec_count,
    ROUND(SUM_TIMER_WAIT / 1000000000000, 2) AS total_time_sec,
    ROUND(AVG_TIMER_WAIT / 1000000000000, 2) AS avg_time_sec,
    SUM_ROWS_EXAMINED AS rows_examined,
    SUM_ROWS_SENT AS rows_sent
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 5;
```

`rows_examined / rows_sent` 비율이 핵심이다. 500만 행을 읽어서 20행을 반환한다면 비율이 250,000:1이다. 이 비율이 높을수록 비효율적인 쿼리다.

<details>
<summary>Performance Schema</summary>

MySQL 내장 모니터링 프레임워크다. 쿼리별 실행 횟수, 평균 실행 시간, 읽은 행 수, 반환한 행 수 등을 수집한다. slow_query_log가 "기준을 넘는 쿼리"만 기록하는 반면, Performance Schema는 모든 쿼리의 통계를 누적한다. 느린 쿼리뿐 아니라 "자주 실행되는 약간 느린 쿼리"도 잡을 수 있다.

</details>

### 방법 3: SHOW PROCESSLIST

실시간으로 실행 중인 쿼리를 본다. 사례에서 처음 원인을 찾을 때 사용한 방법이다.

```sql
SHOW FULL PROCESSLIST;
```

`Time` 컬럼이 수십 초 이상인 쿼리가 보이면 그게 범인이다.

(물론 운영 환경에서는 이 세 가지를 직접 치는 게 아니라, Datadog이나 Percona Monitoring and Management 같은 모니터링 도구가 자동으로 수집한다. 하지만 원리를 알아야 도구가 보여주는 지표를 해석할 수 있다.)


## 16-5. 이 사례의 해결

원인이 세 가지니까 해결도 세 가지다.

### 해결 1: 인덱스를 건다

```sql
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

이 한 줄이면 Full Table Scan이 Index Range Scan으로 바뀐다.

```
-- EXPLAIN 결과 (인덱스 추가 후)
+----+-------+-------+---------------------+---------+------+----------+-------------+
| id | table | type  | key                 | key_len | rows | filtered | Extra       |
+----+-------+-------+---------------------+---------+------+----------+-------------+
|  1 | o     | range | idx_orders_created  | 5       | 150000 | 100.00 | Using where |
+----+-------+-------+---------------------+---------+------+----------+-------------+
```

`type: range` -- 500만 건 중 15만 건만 읽는다. `Using filesort`도 사라졌다. 인덱스가 이미 정렬되어 있으니까 별도 정렬이 필요 없다.

(Ch.11에서 B-Tree 인덱스가 이미 정렬된 상태를 유지한다고 했다. 그래서 `ORDER BY created_at`이 인덱스를 타면 정렬 비용이 0이다.)

### 해결 2: OFFSET을 Cursor-based Pagination으로 교체한다

OFFSET 대신, 마지막으로 본 행의 값을 기준으로 다음 페이지를 가져온다.

```sql
-- OFFSET 방식 (느리다)
SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY created_at DESC
LIMIT 20 OFFSET 99980;

-- Cursor-based 방식 (빠르다)
SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'
  AND (created_at, id) < ('2024-01-15 14:30:00', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Cursor-based 방식은 "이전 페이지의 마지막 행"을 기준점으로 삼는다. DB는 그 기준점부터 20개만 읽으면 된다. 10만 행을 읽고 버릴 필요가 없다. 페이지가 어디든 응답 시간이 일정하다.

<details>
<summary>Cursor-based Pagination (커서 기반 페이지네이션)</summary>

OFFSET 대신 "마지막으로 본 값"을 기준으로 다음 데이터를 가져오는 방식이다. `WHERE id > last_seen_id LIMIT N` 또는 복합 조건 `(created_at, id) < (last_value, last_id)`을 사용한다. OFFSET처럼 앞의 데이터를 읽고 버리는 낭비가 없어서, 페이지 위치와 관계없이 성능이 일정하다. 단점은 "N번째 페이지로 바로 이동"이 안 된다는 것이다. 무한 스크롤이나 "다음 페이지" 방식의 UI에 적합하다.

</details>

### 해결 3: SELECT *를 필요한 컬럼으로 바꾼다

```sql
-- 나쁜 코드
SELECT o.* FROM orders o ...

-- 좋은 코드
SELECT o.id, o.created_at, o.total_price, u.name, p.title
FROM orders o ...
```

필요한 컬럼만 가져오면 행당 데이터 크기가 줄어든다. 디스크 I/O와 네트워크 전송량이 줄고, MySQL의 sort_buffer에 더 많은 행이 들어가서 filesort 확률도 줄어든다.

(운영 환경의 orders 테이블에 JSON 타입의 order_detail 컬럼이 있다고 생각해봐라. 행 하나가 수 KB일 수 있다. 10만 행 x 수 KB면 수백 MB를 읽는 셈이다.)

### 해결 전후 비교

| 지표 | 해결 전 | 해결 후 |
|------|--------|--------|
| 쿼리 실행 시간 | 45초 | 0.02초 |
| 읽는 행 수 | 500만 | 20 |
| Connection 점유 시간 | 45초 | 0.02초 |
| Connection Pool 고갈 | 발생 | 발생 안 함 |

(참고 수치. 인덱스 + Cursor-based Pagination + 컬럼 지정을 모두 적용한 결과. 실제 수치는 하드웨어, 데이터 분포에 따라 다르다.)

45초가 0.02초가 됐다. 2,250배 차이다. Connection 점유 시간이 45초에서 0.02초로 줄었으니, Connection Pool 고갈이 발생할 이유가 없다. 서버를 늘리거나 pool_size를 늘리는 것보다, Slow Query를 고치는 게 근본적인 해결이다.

---

[< 환경 세팅](./README.md) | [쿼리 최적화 >](./02-query-optimization.md)
