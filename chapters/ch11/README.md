# Ch.11 정렬과 검색, 그리고 인덱스의 원리

Ch.10에서 List vs Set vs Dict의 검색 성능 차이를 확인했다. Hash Table은 "있느냐 없느냐"를 O(1)로 판별한다. 그런데 "범위 검색"은? "10~20 사이의 값을 전부 찾아라"를 Hash Table로는 할 수 없다. 정렬과 Binary Search, 그리고 B-Tree가 필요한 이유다.

정렬을 모르면 DB 인덱스를 이해할 수 없다. 인덱스가 왜 빠른지도, 왜 때때로 안 타는지도.

---

## 이 챕터에서 다루는 것

- 정렬 알고리즘의 실무적 선택 기준
- Binary Search의 전제 조건과 동작 원리
- B-Tree 인덱스가 왜 DB에서 쓰이는가
- EXPLAIN으로 인덱스 효과 확인

## 환경

Ch.10과 동일하다. DB 인덱스 실습은 SQLite를 사용한다 (별도 설치 불필요, Python 내장).

| 도구 | 용도 |
|------|------|
| Python 3.12 | 정렬/검색 벤치마크 |
| SQLite | 인덱스 효과 확인 (EXPLAIN) |

## 목차

1. [사례 - 매 요청마다 정렬하는 API](./01-case.md)
2. [Binary Search와 B-Tree](./02-binary-search-btree.md)
3. [인덱스의 원리](./03-index-internals.md)
4. [유사 사례와 키워드 정리](./04-summary.md)
