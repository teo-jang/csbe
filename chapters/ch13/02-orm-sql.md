# Ch.13 ORM과 SQL - 왜 SQL을 알아야 하는가

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 N+1 Problem이 뭔지, Eager Loading으로 쿼리를 줄이는 방법을 확인했다. 그런데 "쿼리를 줄였다"는 것만으로는 충분하지 않다. 줄인 쿼리가 효율적인지도 확인해야 한다. ORM이 생성하는 SQL을 눈으로 보고, 그 SQL의 실행 계획을 읽을 줄 알아야 한다.


## 13-5. ORM이 생성하는 SQL 확인하기

### echo=True: 가장 간단한 방법

SQLAlchemy 엔진을 만들 때 `echo=True`를 넣으면, 실행되는 모든 SQL이 콘솔에 찍힌다.

```python
engine = create_engine(
    "mysql+pymysql://root:csbe@localhost:3306/csbe_study",
    echo=True,  # SQL 로그 출력
)
```

서버를 실행하고 API를 호출하면 이런 로그가 나온다:

```
INFO sqlalchemy.engine.Engine SELECT users.id, users.name FROM users
INFO sqlalchemy.engine.Engine SELECT orders.id, orders.user_id, orders.product, orders.amount
FROM orders WHERE orders.user_id = %(param_1)s
INFO sqlalchemy.engine.Engine [cached since 0.001s ago] {'param_1': 1}
INFO sqlalchemy.engine.Engine [cached since 0.001s ago] {'param_1': 2}
...
```

Lazy Loading이면 `SELECT ... FROM orders WHERE user_id = ?`가 유저 수만큼 반복된다. Eager Loading이면 JOIN 쿼리 하나가 찍힌다. 이걸 보는 순간 N+1인지 아닌지 바로 알 수 있다.

(운영 환경에서 echo=True를 켜면 로그가 폭발한다. 개발/디버깅 때만 쓰고, 운영에서는 Slow Query Log나 APM 도구로 특정 쿼리를 추적한다.)

### logging으로 더 세밀하게 제어하기

echo=True는 전체 SQL을 다 찍는다. 특정 쿼리만 보고 싶으면 Python logging을 쓴다:

```python
import logging

# SQLAlchemy 엔진 로그만 DEBUG로
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
```

Java의 JPA라면 `spring.jpa.show-sql=true`나 `hibernate.format_sql=true`에 해당한다. Django ORM이라면 settings.py의 `LOGGING`에서 `django.db.backends`를 DEBUG로 설정한다.

어떤 ORM을 쓰든, "ORM이 생성한 SQL을 확인하는 방법"은 반드시 알아야 한다.


## 13-6. EXPLAIN: 쿼리 실행 계획 읽기

SQL을 확인했다. 그 다음은 "이 SQL이 효율적으로 실행되는가?"를 판단해야 한다. 여기서 EXPLAIN이 등장한다.

<details>
<summary>QEP (Query Execution Plan, 쿼리 실행 계획)</summary>

DB 엔진이 SQL을 실행할 때 내부적으로 세우는 실행 전략이다. "어떤 테이블을 먼저 읽을까", "인덱스를 쓸까 말까", "JOIN은 어떤 방식으로 할까"를 결정한다.

EXPLAIN 명령어로 이 실행 계획을 미리 확인할 수 있다. 쿼리를 실제로 실행하지 않고도, DB가 어떤 전략으로 실행할지 알 수 있다.

Ch.11에서 인덱스를 다룰 때 EXPLAIN을 잠깐 봤다. 이번에는 ORM이 만든 쿼리에 EXPLAIN을 걸어본다.

</details>

### EXPLAIN 기본 사용법

ORM이 생성한 SQL을 복사해서 앞에 `EXPLAIN`을 붙이면 된다:

```sql
EXPLAIN SELECT users.id, users.name, orders.id, orders.user_id, orders.product, orders.amount
FROM users
LEFT OUTER JOIN orders ON users.id = orders.user_id;
```

결과:

```
+----+-------------+--------+------+---------------+---------+---------+------------------+------+-------+
| id | select_type | table  | type | possible_keys | key     | key_len | ref              | rows | Extra |
+----+-------------+--------+------+---------------+---------+---------+------------------+------+-------+
|  1 | SIMPLE      | users  | ALL  | NULL          | NULL    | NULL    | NULL             | 1000 | NULL  |
|  1 | SIMPLE      | orders | ref  | idx_user_id   | idx_user_id | 5   | csbe.users.id    |    5 | NULL  |
+----+-------------+--------+------+---------------+---------+---------+------------------+------+-------+
```

이 결과에서 봐야 할 핵심 컬럼:

| 컬럼 | 의미 | 이번 예시에서 |
|------|------|-------------|
| type | 접근 방식 | users: ALL (Full Table Scan), orders: ref (인덱스 참조) |
| key | 실제로 사용한 인덱스 | orders: idx_user_id |
| rows | 예상 스캔 행 수 | users: 1,000행, orders: 유저당 5행 |
| Extra | 추가 정보 | NULL (특별한 문제 없음) |

type 컬럼이 가장 중요하다. 성능이 좋은 순서대로:

```
system > const > eq_ref > ref > range > index > ALL
```

- ALL: Full Table Scan. 인덱스 없이 전체 행을 읽는다. Ch.11에서 다뤘던 그거다.
- ref: 인덱스를 사용해서 매칭되는 행을 찾는다.
- const: Primary Key나 Unique 인덱스로 한 행만 읽는다. 가장 빠르다.

위 예시에서 users 테이블은 type이 ALL이다. 전체 유저를 가져오니까 Full Table Scan이 맞다. 문제는 orders 테이블에 인덱스(idx_user_id)가 있느냐 없느냐다. 인덱스가 없으면 orders도 ALL이 된다. 유저 1,000명 x orders 전체 스캔 = 재앙이다.

### 인덱스가 없을 때의 EXPLAIN

orders 테이블에서 user_id 인덱스를 제거하고 같은 쿼리를 실행하면:

```sql
EXPLAIN SELECT users.id, users.name, orders.id, orders.user_id, orders.product, orders.amount
FROM users
LEFT OUTER JOIN orders ON users.id = orders.user_id;
```

```
+----+-------------+--------+------+---------------+------+---------+------+-------+----------------------------------------------------+
| id | select_type | table  | type | possible_keys | key  | key_len | ref  | rows  | Extra                                              |
+----+-------------+--------+------+---------------+------+---------+------+-------+----------------------------------------------------+
|  1 | SIMPLE      | users  | ALL  | NULL          | NULL | NULL    | NULL |  1000 | NULL                                               |
|  1 | SIMPLE      | orders | ALL  | NULL          | NULL | NULL    | NULL | 50000 | Using where; Using join buffer (Block Nested Loop)  |
+----+-------------+--------+------+---------------+------+---------+------+-------+----------------------------------------------------+
```

orders의 type이 ALL로 바뀌었다. rows가 50,000이다. 유저 1명을 처리할 때마다 orders 테이블 50,000행을 전부 스캔한다는 뜻이다. 유저 1,000명이면? 1,000 x 50,000 = 50,000,000번의 행 비교. Extra에 `Block Nested Loop`가 보인다. JOIN을 할 때 인덱스가 없어서 블록 단위로 전부 비교하는 방식이다.

(이 정도 되면 ORM 최적화보다 인덱스 설정이 더 급하다. 인덱스 이야기는 Ch.14에서 본격적으로 한다.)


## 13-7. CBO: DB가 실행 계획을 세우는 방식

"EXPLAIN 결과를 누가 만드는가?" DB 엔진 안에 있는 Optimizer가 만든다. 현대 RDBMS의 Optimizer는 대부분 CBO(Cost-Based Optimizer)다.

<details>
<summary>CBO (Cost-Based Optimizer, 비용 기반 최적화기)</summary>

SQL을 실행할 수 있는 여러 방법(실행 계획) 중에서, "비용이 가장 낮은 것"을 선택하는 DB 내부 모듈이다. 여기서 "비용"이란 디스크 I/O 횟수, CPU 연산량, 메모리 사용량 등의 추정치다.

예를 들어 `SELECT * FROM orders WHERE user_id = 5` 쿼리를 실행하는 방법은 최소 두 가지다:
1. Full Table Scan: 50,000행을 전부 읽고 user_id = 5인 행을 걸러낸다
2. Index Scan: user_id 인덱스에서 5를 찾고, 해당 행만 읽는다

CBO는 테이블 통계 정보(행 수, 컬럼 값의 분포, 인덱스 유무 등)를 참고해서 각 방법의 비용을 계산하고, 비용이 낮은 쪽을 선택한다. 보통 인덱스가 있으면 Index Scan을 선택한다.

다만 CBO도 만능은 아니다. 통계 정보가 오래되었거나, 특수한 데이터 분포에서는 잘못된 계획을 세울 수 있다. 그래서 EXPLAIN으로 실제 실행 계획을 확인하는 게 중요하다.

(Oracle, MySQL, PostgreSQL 전부 CBO를 사용한다. MySQL 5.0 이전에는 Rule-Based Optimizer도 있었지만, 현재는 거의 CBO 기반이다.)

</details>

CBO가 참고하는 정보:

1. 테이블 통계: 전체 행 수, 컬럼별 값의 분포(카디널리티)
2. 인덱스 정보: 어떤 인덱스가 있는지, 인덱스의 선택도(selectivity)
3. 하드웨어 비용 모델: 순차 읽기 vs 랜덤 읽기 비용 비율

CBO가 "인덱스를 안 쓰겠다"고 판단하는 경우도 있다. 예를 들어 테이블에 행이 100개밖에 없으면, 인덱스를 타는 것보다 Full Table Scan이 더 빠를 수 있다. 인덱스를 타려면 인덱스 트리를 탐색한 다음 데이터 페이지로 점프해야 하는데, 100행이면 그냥 전부 읽는 게 더 빠르다.

이게 "인덱스를 걸었는데 왜 안 타는가?"의 답 중 하나다. EXPLAIN으로 확인해야 한다. Ch.14에서 인덱스를 깊게 다룰 때 이 이야기를 더 한다.


## 13-8. ORM을 쓰더라도 SQL을 알아야 하는 이유

정리해보겠다.

1. N+1 Problem은 코드만 봐서는 발견할 수 없다. 쿼리 로그를 봐야 한다.
2. 쿼리 로그를 봐도 "이게 느린 쿼리인지"는 EXPLAIN을 해봐야 안다.
3. EXPLAIN 결과를 읽으려면 SQL과 인덱스를 알아야 한다.

ORM은 편리하다. 테이블 생성, 마이그레이션, 간단한 CRUD를 손쉽게 처리해준다. 하지만 ORM이 생성하는 SQL을 읽을 줄 모르면, 운영에서 성능 문제가 터졌을 때 원인을 찾을 수 없다.

비유를 하나 하겠다. 자동차의 오토매틱 변속기를 쓴다고 해서 엔진의 원리를 몰라도 되는 건 아니다. 평소에는 D(Drive)에 놓고 편하게 몰면 된다. 하지만 언덕에서 차가 밀리거나, RPM이 비정상적으로 높아질 때, 왜 그런지 이해하려면 엔진과 변속기의 관계를 알아야 한다. ORM이 오토매틱 변속기고, SQL이 엔진이다.

(뭐 이 비유가 정확한지는 잘 모르겠다. 자동차에 대한 지식은 이 강의 작성자의 전문 분야가 아니다.)

개발자 A와 개발자 B의 차이를 보겠다.

```
개발자 A: "API가 느려요. 서버를 늘릴까요?"
→ 서버를 3대로 늘렸다
→ DB Connection이 3배로 늘어서 DB가 더 느려졌다
→ 원인: N+1 쿼리 1,001개가 매 요청마다 실행되고 있었다
```

```
개발자 B: "API가 느려요. 쿼리 로그부터 확인하겠습니다."
→ echo=True로 쿼리 확인: N+1 발견
→ joinedload로 쿼리를 1개로 줄임
→ EXPLAIN으로 JOIN이 인덱스를 잘 타는지 확인
→ 응답 시간 520ms → 35ms
```

개발자 B가 처음부터 EXPLAIN을 알았던 건 아니다. "쿼리 로그를 확인해봐야 한다"는 키워드를 알고 있었을 뿐이다. 키워드를 알면 검색이 된다. "sqlalchemy n+1"이라고 검색하면 joinedload가 나온다. "mysql explain type all"이라고 검색하면 Full Table Scan이 나온다. 키워드를 모르면? "API 느림 해결"이라고 검색하게 된다. 그러면 "서버 늘려라", "Redis 붙여라" 같은 답이 나온다.

이게 Ch.1에서부터 계속 이야기해온 거다. 키워드를 아느냐 모르느냐의 차이.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
