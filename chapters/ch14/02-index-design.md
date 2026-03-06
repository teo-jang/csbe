# Ch.14 인덱스 설계의 원리

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 인덱스 하나로 300만 건 Full Table Scan을 47건 Index Scan으로 줄였다. 700배 차이. 그런데 인덱스를 아무렇게나 걸면 되는 게 아니다. 어떤 인덱스를 걸어야 하는지, 왜 어떤 경우에는 인덱스가 안 타는지를 알아야 한다.


## B-Tree Index vs Hash Index

Ch.11에서 B-Tree가 DB 인덱스의 핵심 자료구조라고 했다. 그런데 MySQL에는 Hash Index도 있다. 뭐가 다른가?

| 특성 | B-Tree Index | Hash Index |
|------|-------------|------------|
| 같은 값 검색 (=) | O(log n) | O(1) |
| 범위 검색 (>, <, BETWEEN) | 가능 | 불가능 |
| 정렬 (ORDER BY) | 가능 (이미 정렬됨) | 불가능 |
| 부분 일치 (LIKE 'abc%') | 가능 (앞부분 매칭) | 불가능 |
| 디스크 친화성 | 좋음 (순차 I/O) | 나쁨 (랜덤 I/O) |

<details>
<summary>Hash Index (해시 인덱스)</summary>

Ch.10에서 다뤘던 Hash Table을 인덱스에 적용한 것이다. 키를 Hash 함수에 넣고, 나온 Hash 값으로 바로 위치를 찾는다. O(1)이라 같은 값 검색은 B-Tree보다 빠르다. 하지만 범위 검색과 정렬이 불가능하다. Hash 값은 원래 값의 순서를 보존하지 않기 때문이다.

MySQL의 InnoDB 엔진은 기본적으로 B-Tree 인덱스를 사용한다. Hash Index는 MEMORY 엔진에서만 지원한다. (정확히는 InnoDB가 내부적으로 Adaptive Hash Index를 자동 생성하기도 하지만, 사용자가 직접 Hash Index를 만들 수는 없다.)

PostgreSQL에서는 `CREATE INDEX ... USING HASH`로 명시적으로 만들 수 있다.

</details>

실무에서 99%는 B-Tree(정확히는 B+Tree) 인덱스를 쓴다. 범위 검색과 정렬이 안 되는 인덱스는 쓸모가 제한적이다. "주문을 최신순으로 20개 가져와라", "가격이 1만원~5만원 사이인 상품을 찾아라" 같은 쿼리가 현실에서 대부분이니까.

Hash Index가 유리한 경우는 "정확히 같은 값 검색"만 하는 아주 특수한 상황이다. 예를 들어 세션 ID로 세션 데이터를 찾는 경우. 하지만 이런 경우에도 B-Tree의 O(log n)이 충분히 빠르기 때문에, 굳이 Hash Index를 선택할 이유가 거의 없다.


## Covering Index: 인덱스만으로 쿼리를 처리한다

보통 인덱스를 타면 이런 과정을 거친다:

```
1. 인덱스(B+Tree)에서 조건에 맞는 레코드의 위치(PK)를 찾는다
2. 그 PK로 실제 테이블 데이터를 읽는다 (이걸 "테이블 룩업"이라고 한다)
```

이 2단계가 비용이다. 특히 인덱스에서 찾은 레코드가 많으면, 테이블 룩업이 수백~수천 번 일어난다.

Covering Index는 이 2단계를 1단계로 줄인다. 쿼리에서 필요한 모든 컬럼이 인덱스에 포함되어 있으면, 테이블을 안 봐도 된다. 인덱스만으로 쿼리가 완결된다.

```sql
-- 인덱스: (user_id, created_at)
-- 이 쿼리는 Covering Index가 아님 (SELECT * 때문에 모든 컬럼이 필요)
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 20;

-- 이 쿼리는 Covering Index (user_id와 created_at만 있으면 됨)
SELECT user_id, created_at FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 20;
```

EXPLAIN에서 `Extra: Using index`가 나오면 Covering Index가 적용된 것이다.

<details>
<summary>Covering Index (커버링 인덱스)</summary>

쿼리가 요구하는 모든 컬럼이 인덱스에 포함되어 있어서, 테이블 데이터를 읽지 않고 인덱스만으로 결과를 반환하는 인덱스다. 테이블 룩업(Random I/O)을 제거하기 때문에 성능이 크게 향상된다.

"인덱스가 쿼리를 커버한다"는 뜻이다. `SELECT *`를 쓰면 거의 불가능하고, 필요한 컬럼만 SELECT해야 Covering Index의 혜택을 받을 수 있다. "SELECT *을 쓰지 마라"는 조언의 기술적 근거 중 하나가 이거다.

</details>

실무에서 Covering Index를 노리는 경우:

```sql
-- 주문 목록에서 ID와 날짜만 필요한 경우
CREATE INDEX idx_orders_cover ON orders(user_id, created_at, order_id);

SELECT order_id, created_at
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;
-- Extra: Using index (Covering Index!)
```

물론 인덱스에 컬럼을 많이 넣으면 인덱스 크기가 커지고, INSERT/UPDATE 성능이 떨어진다. 트레이드오프다. 자주 실행되는 핵심 쿼리에 한해서 Covering Index를 고려하는 게 맞다.


## 복합 인덱스(Composite Index)와 컬럼 순서

앞의 사례에서 `(user_id, created_at DESC)` 복합 인덱스를 만들었다. 이건 user_id로 먼저 정렬하고, 같은 user_id 안에서 created_at DESC로 정렬한 B+Tree를 만든다는 뜻이다.

전화번호부를 생각하면 된다. "성 → 이름" 순서로 정렬되어 있다. "김"씨를 찾고, 그 안에서 "영희"를 찾는 건 쉽다. 하지만 "영희"만으로 찾으려면? 전화번호부 전체를 뒤져야 한다.

복합 인덱스도 같은 원리다. 인덱스가 `(A, B, C)` 순서라면:

| 쿼리 | 인덱스 사용 | 이유 |
|------|-----------|------|
| WHERE A = 1 | 사용 | 첫 번째 컬럼 |
| WHERE A = 1 AND B = 2 | 사용 | 첫 번째 + 두 번째 |
| WHERE A = 1 AND B = 2 AND C = 3 | 사용 | 전체 |
| WHERE B = 2 | 미사용 | 첫 번째 컬럼을 건너뜀 |
| WHERE B = 2 AND C = 3 | 미사용 | 첫 번째 컬럼을 건너뜀 |
| WHERE A = 1 AND C = 3 | A만 사용 | B를 건너뛰어서 C는 인덱스 못 탐 |

이걸 "Leftmost Prefix Rule (왼쪽 접두사 규칙)"이라고 한다. 복합 인덱스는 왼쪽부터 순서대로 사용된다.

<details>
<summary>Composite Index (복합 인덱스)</summary>

두 개 이상의 컬럼을 하나의 인덱스로 묶은 것이다. `CREATE INDEX idx ON table(col_a, col_b, col_c)` 형태다. 컬럼 순서가 매우 중요한데, 왼쪽부터 순서대로 사용되는 Leftmost Prefix Rule을 따른다. 순서를 잘못 잡으면 인덱스가 있어도 안 탄다.

Java의 JPA에서는 `@Index(columnList = "col_a, col_b")`로 정의한다. Python SQLAlchemy에서는 `Index('idx_name', col_a, col_b)`로 정의한다.

</details>

그래서 복합 인덱스의 컬럼 순서를 정할 때 원칙이 있다:

1. WHERE 절에서 "=" 조건으로 사용되는 컬럼을 앞에 놓는다
2. WHERE 절에서 범위 조건(>, <, BETWEEN)으로 사용되는 컬럼은 그 다음에 놓는다
3. ORDER BY 컬럼은 그 뒤에 놓는다

범위 조건 이후의 컬럼은 인덱스를 탈 수 없다. 범위 조건에서 B+Tree의 순서가 깨지기 때문이다.

```sql
-- 쿼리: WHERE status = 'completed' AND price > 10000 ORDER BY created_at

-- 좋은 인덱스 순서: (status, price, created_at)
-- status = 'completed' → B+Tree에서 바로 찾음
-- price > 10000 → 범위 검색 가능
-- created_at → 범위 조건 뒤이므로 정렬에는 인덱스 못 탐 (filesort 발생)

-- 더 좋은 방법: 쿼리 패턴에 따라 결정
-- status + created_at 조합이 더 자주 쓰인다면: (status, created_at)
```

(정답은 "쿼리 패턴에 따라 다르다"이다. 실무에서는 가장 자주 실행되는 쿼리 Top 5를 뽑고, 그 쿼리들을 커버하는 인덱스를 설계한다.)


## Cardinality: 인덱스 효율의 척도

Cardinality는 컬럼에 포함된 고유 값(distinct value)의 수다. 쉽게 말해 "이 컬럼의 값이 얼마나 다양한가"이다.

| 컬럼 | Cardinality | 인덱스 효율 |
|------|-------------|-----------|
| user_id (300만 건 중 10만 명) | 100,000 | 높음 - 한 값당 평균 30건 |
| gender (M/F) | 2 | 매우 낮음 - 한 값당 150만 건 |
| email (유니크) | 3,000,000 | 최고 - 한 값당 1건 |
| status (5종류) | 5 | 낮음 - 한 값당 60만 건 |

<details>
<summary>Cardinality (카디널리티)</summary>

컬럼이 가진 고유 값의 수를 말한다. Cardinality가 높을수록 인덱스의 선택도(Selectivity)가 높아서 인덱스 효율이 좋다. 반대로 Cardinality가 낮으면 (예: 성별처럼 2~3종류), 인덱스를 타도 결국 대량의 행을 읽어야 하니 Full Table Scan과 별 차이가 없다.

MySQL에서는 `SHOW INDEX FROM table_name`으로 각 인덱스의 Cardinality를 확인할 수 있다. 이 값은 통계적 추정치이므로 `ANALYZE TABLE`로 갱신할 수 있다.

</details>

gender 컬럼에 인덱스를 건다고 생각해보자. `WHERE gender = 'M'`이면 300만 건 중 150만 건을 읽어야 한다. 테이블의 절반을 인덱스로 찾아가면서 일일이 읽는 것보다, 차라리 Full Table Scan이 더 빠를 수 있다. DB 옵티마이저도 이걸 알고 있어서, Cardinality가 낮은 인덱스는 무시하고 Full Table Scan을 선택하기도 한다.

인덱스를 걸 때의 원칙: Cardinality가 높은 컬럼에 인덱스를 건다. email, user_id 같은 컬럼이 좋은 후보다. gender, is_active 같은 컬럼은 단독 인덱스로는 효과가 없다.

(다만 복합 인덱스에서는 Cardinality가 낮은 컬럼도 의미가 있다. `(status, created_at)` 인덱스에서 status가 5종류뿐이라도, status = 'active'인 행들 중에서 created_at으로 정렬/범위검색을 할 수 있으니까.)


## 인덱스 안티패턴: 이러면 인덱스가 안 탄다

인덱스를 걸어놨는데도 EXPLAIN에서 `type: ALL`이 나오는 경우가 있다. 인덱스를 무력화하는 패턴들이다.

### 1. 컬럼에 함수 적용

```sql
-- 인덱스 안 탐
SELECT * FROM orders WHERE YEAR(created_at) = 2024;

-- 인덱스 탐
SELECT * FROM orders WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

`YEAR(created_at)`는 created_at의 값을 변환한다. B+Tree는 원래 값으로 정렬되어 있는데, 함수를 적용하면 정렬 순서가 달라진다. DB가 인덱스를 쓸 수 없는 이유다.

(MySQL 8.0부터는 함수 기반 인덱스를 지원한다. `CREATE INDEX idx ON orders((YEAR(created_at)))` 형태로 만들 수 있다. 하지만 범위 쿼리로 바꾸는 게 더 범용적이다.)

### 2. LIKE '%keyword' (앞에 와일드카드)

```sql
-- 인덱스 안 탐
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- 인덱스 탐
SELECT * FROM users WHERE email LIKE 'test%';
```

B+Tree는 왼쪽부터 정렬되어 있다. 전화번호부에서 "성이 김인 사람"은 찾을 수 있지만, "이름이 영희로 끝나는 사람"은 전체를 뒤져야 하는 것과 같다. `LIKE 'test%'`는 "test로 시작하는" 범위 검색이라 인덱스를 탈 수 있다.

(앞에 와일드카드를 써야 하는 경우라면, Full-Text Index나 Elasticsearch 같은 별도의 검색 엔진을 고려해야 한다.)

### 3. OR 조건

```sql
-- 인덱스가 user_id에만 있는 경우
-- 인덱스를 효율적으로 쓰기 어렵다
SELECT * FROM orders WHERE user_id = 123 OR status = 'pending';
```

OR 조건은 두 조건 중 하나라도 만족하면 되므로, 한쪽만 인덱스를 타도 다른 쪽은 Full Table Scan이 필요할 수 있다. MySQL은 `index_merge` 최적화를 시도하기도 하지만, 항상 효율적이지는 않다.

해결 방법:

```sql
-- UNION으로 분리하면 각각 인덱스를 탈 수 있다
SELECT * FROM orders WHERE user_id = 123
UNION
SELECT * FROM orders WHERE status = 'pending';
```

### 4. 암묵적 형변환

```sql
-- user_id가 INT인데 문자열로 비교
SELECT * FROM orders WHERE user_id = '123';
```

MySQL은 이 경우 암묵적으로 형변환을 수행한다. 문자열 '123'을 숫자 123으로 바꿔서 비교하므로 인덱스를 탈 수는 있다. 하지만 반대의 경우:

```sql
-- phone이 VARCHAR인데 숫자로 비교
SELECT * FROM users WHERE phone = 01012345678;
```

이 경우 DB가 phone 컬럼의 모든 값을 숫자로 변환해야 하므로, 인덱스를 탈 수 없다. 컬럼의 타입과 비교 값의 타입은 반드시 일치시켜야 한다.

---

정리하면:

```
인덱스가 안 타는 4가지 패턴:
1. 컬럼에 함수 적용 → 범위 쿼리로 변환
2. LIKE '%keyword' → Full-Text Index 또는 검색 엔진
3. OR 조건 → UNION으로 분리
4. 암묵적 형변환 → 타입 일치
```

인덱스를 걸어놨는데 안 타면, 이 네 가지부터 의심해보자. EXPLAIN이 답을 알려준다.

인덱스 설계는 "뭘 걸까"보다 "왜 안 타는가"를 아는 게 더 중요하다.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
