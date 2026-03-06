# Ch.11 인덱스의 원리

[< Binary Search와 B-Tree](./02-binary-search-btree.md) | [유사 사례와 키워드 정리 >](./04-summary.md)

---

앞에서 B-Tree가 디스크 I/O를 최소화하면서 O(log n) 검색을 제공한다는 걸 봤다. 이제 실제 DB 인덱스가 어떻게 동작하는지 본다.


## 인덱스가 하는 일

인덱스는 책의 목차와 같다. 500페이지짜리 책에서 "TCP"라는 단어를 찾으려면:

- 목차 없음: 1페이지부터 500페이지까지 넘기면서 찾는다 (Full Table Scan)
- 목차 있음: "T" 섹션을 찾고, "TCP → 342페이지"를 보고 바로 간다 (Index Scan)

DB 인덱스도 이 원리다. `CREATE INDEX idx_email ON users(email)`을 실행하면, email 컬럼의 값들을 B+Tree로 정렬해서 별도의 자료구조를 만든다. 검색할 때 이 트리를 타고 바로 해당 레코드를 찾는다.

```sql
-- 인덱스 없을 때: Full Table Scan (모든 행을 순회)
SELECT * FROM users WHERE email = 'test@test.com';

-- email에 인덱스가 있을 때: Index Scan (B+Tree에서 바로 찾음)
SELECT * FROM users WHERE email = 'test@test.com';
```

SQL은 동일하다. DB 엔진이 인덱스 유무를 판단해서 알아서 최적의 경로를 선택한다.


## EXPLAIN: 인덱스를 타는지 확인하는 방법

쿼리가 인덱스를 사용하는지 확인하려면 `EXPLAIN` 명령을 쓴다.

```sql
-- 인덱스가 없는 경우
EXPLAIN SELECT * FROM users WHERE email = 'test@test.com';
-- type: ALL (Full Table Scan)

-- 인덱스를 추가한 후
CREATE INDEX idx_users_email ON users(email);
EXPLAIN SELECT * FROM users WHERE email = 'test@test.com';
-- type: ref (Index Scan)
```

`type: ALL`은 전체 테이블을 스캔한다는 뜻이다. 데이터가 많으면 치명적이다. `type: ref`나 `type: const`가 나오면 인덱스를 타고 있다는 뜻이다.

(MySQL 기준으로 `EXPLAIN`의 type 컬럼에 나올 수 있는 값은 system, const, eq_ref, ref, range, index, ALL 순으로 좋다. ALL이 최악이고, const가 최선이다. Ch.14에서 상세히 다룬다.)


## 인덱스의 비용

인덱스가 공짜는 아니다.

| 항목 | 비용 |
|------|------|
| 디스크 공간 | 인덱스도 저장해야 한다 (테이블 크기의 10~30% 추가) |
| INSERT 성능 | 레코드를 추가할 때 인덱스도 갱신해야 한다 |
| UPDATE 성능 | 인덱스 컬럼이 변경되면 인덱스도 재정렬 |
| DELETE 성능 | 인덱스에서도 제거해야 한다 |

읽기 성능은 올라가지만 쓰기 성능은 내려간다. 그래서 "모든 컬럼에 인덱스를 걸면 빠르겠지"는 틀린 생각이다. 자주 검색하는 컬럼에만 전략적으로 걸어야 한다.

(인덱스 설계 원칙은 Ch.14에서 자세히 다룬다. 카디널리티, Covering Index, 복합 인덱스 순서 등.)


## 정렬 알고리즘과 DB의 관계

사례에서 "애플리케이션에서 정렬하지 말고 DB에서 하라"고 했다. DB가 정렬을 더 잘하는 이유:

1. 인덱스가 있으면 정렬이 필요 없다 (이미 정렬된 B+Tree)
2. 인덱스가 없어도, DB는 디스크 기반 외부 정렬(External Sort)에 최적화되어 있다
3. `LIMIT`이 있으면 전체를 정렬하지 않고 상위 N개만 추출하는 최적화가 가능하다 (Top-N Sort)

<details>
<summary>Tim Sort (팀 정렬)</summary>

Python의 `list.sort()`와 `sorted()`가 사용하는 정렬 알고리즘이다. Merge Sort와 Insertion Sort를 결합한 하이브리드 정렬로, 실제 데이터에서 자주 나타나는 "거의 정렬된" 패턴에 특히 효율적이다. 최선 O(n), 평균/최악 O(n log n)이다. Java의 `Arrays.sort()`도 Tim Sort를 사용한다.

</details>

<details>
<summary>Full Table Scan (풀 테이블 스캔)</summary>

테이블의 모든 행을 처음부터 끝까지 읽는 것이다. 인덱스를 사용하지 않는다. 데이터가 적을 때는 문제없지만, 수십만 건 이상이면 성능 문제의 주범이 된다. Ch.10의 List에서 Linear Search하는 것과 같은 원리다. EXPLAIN에서 `type: ALL`로 나타난다.

</details>

<details>
<summary>Index Scan (인덱스 스캔)</summary>

인덱스를 사용해서 필요한 행만 빠르게 찾는 것이다. B+Tree를 타고 원하는 위치로 바로 이동한다. Full Table Scan 대비 수십~수백 배 빠를 수 있다. EXPLAIN에서 `type: ref`, `type: range` 등으로 나타난다.

</details>

정렬 알고리즘 자체를 외우는 것보다, "정렬이 필요한 상황에서 가장 효율적인 방법이 뭔가"를 판단하는 능력이 실무에서 중요하다. 대부분의 경우 그 답은 "DB에 인덱스를 걸고 DB에서 하라"다.

---

[< Binary Search와 B-Tree](./02-binary-search-btree.md) | [유사 사례와 키워드 정리 >](./04-summary.md)
