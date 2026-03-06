# Ch.10 contains()를 쓰지 마세요 - 자료구조 선택의 기준

Part 2 (Ch.7~9)에서 AI 도구를 잘 쓰려면 CS 키워드가 필요하다는 걸 확인했다. Part 3부터는 다시 CS 본론이다. 자료구조와 알고리즘, 그 중에서도 실무에서 가장 자주 발목을 잡는 주제부터 시작한다.

코드 한 줄이 성능을 수천 배 바꿀 수 있다. `in` 연산자 하나가.

---

## 이 챕터에서 다루는 것

- List에서 `in` 연산자(contains)를 쓰면 왜 느린가
- List, Set, Dict의 내부 구조 차이
- Hash Table과 Hash 충돌
- 자료구조 선택의 기준: "무엇을 자주 하는가"

## 환경

Ch.2~6과 동일한 Python 환경이다. 이번 챕터는 DB가 필요 없다.

| 도구 | 용도 |
|------|------|
| Python 3.12 | 벤치마크 실행 |
| FastAPI + uvicorn | 테스트 서버 |
| k6 | 부하 테스트 (선택) |
| time.perf_counter() | 정밀 시간 측정 |

## 목차

1. [사례 - contains()가 API를 멈추게 한 날](./01-case.md)
2. [Hash Table과 시간 복잡도](./02-hash-table.md)
3. [자료구조 선택의 기준](./03-choosing-ds.md)
4. [유사 사례와 키워드 정리](./04-summary.md)
