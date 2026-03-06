# CSBE - Computer Science for Backend Engineer

Backend Engineer, MLOps, ML SW Engineer 및 지망생을 위한 CS 강의 자료다.

AI 도구(Claude Code, Cursor 등)를 활용하는 시대에 왜 CS를 알아야 하는지,
"키워드를 모르면 검색도 못 하고 AI도 엉뚱한 답을 준다"는 관점에서 CS를 다룬다.

---

## 커리큘럼

### Part 1. 기초 체력 (Ch.1~6)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.1 | [왜 CS를 공부해야 하는가](ch01/README.md) | CS를 모르면 키워드를 모르고, 키워드를 모르면 검색도 AI 활용도 못 한다 |
| Ch.2 | [로그를 뺐더니 빨라졌어요? (1)](ch02/README.md) | print문이 왜 느린지 - System Call과 커널 |
| Ch.3 | [로그를 뺐더니 빨라졌어요? (2)](ch03/README.md) | CPU Bound와 I/O Bound, async의 오해 |
| Ch.4 | [프로세스와 스레드, 진짜로 이해하고 있는가](ch04/README.md) | Memory Layout, Virtual Memory, OOM |
| Ch.5 | [동시성 제어의 기초](ch05/README.md) | Race Condition, Mutex, Deadlock |
| Ch.6 | [네트워크 기초](ch06/README.md) | TCP/IP, Connection Pool, TIME_WAIT |

### Part 2. AI 도구와 CS의 접점 (Ch.7~9)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.7 | [AI가 코드를 짜주는 시대, 왜 CS를 알아야 하는가](ch07/README.md) | 프롬프트에 CS 키워드가 없으면 AI는 엉뚱한 방향으로 간다 |
| Ch.8 | [AI에게 좋은 지시를 내리기 위한 CS 키워드 사전](ch08/README.md) | 카테고리별 핵심 키워드 |
| Ch.9 | [AI가 만든 코드 리뷰하기](ch09/README.md) | CS 관점 코드 리뷰 체크리스트 |

### Part 3. 자료구조와 알고리즘의 실무 (Ch.10~12)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.10 | [contains()를 쓰지 마세요](ch10/README.md) | 자료구조 선택의 기준, List vs Set vs Map |
| Ch.11 | [정렬과 검색, 그리고 인덱스의 원리](ch11/README.md) | B-Tree와 Index |
| Ch.12 | 트리, 그래프, 그리고 실무 | BFS/DFS 실무 활용, DAG |

### Part 4. 데이터베이스 깊게 보기 (Ch.13~16)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.13 | JPA를 써서 DB를 모른다고요? | ORM이 생성하는 SQL, N+1 |
| Ch.14 | 인덱스를 안 걸어놓고 Redis를 설치했습니다 | Index 작동 원리 |
| Ch.15 | Transaction과 Isolation Level | ACID, 동시성 문제 |
| Ch.16 | DB 성능 튜닝의 실무 | Slow Query, Connection Pool |

### Part 5. 캐시와 성능 최적화 (Ch.17~19)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.17 | 느리니까 Redis 붙이고 생각해볼까요? | Cache Stampede, TTL, Eviction |
| Ch.18 | Local Cache vs Remote Cache | 계층 캐시 설계 |
| Ch.19 | Replica를 200개로 늘려볼까요? | Bottleneck 식별, Amdahl's Law |

### Part 6. 소프트웨어 설계와 아키텍처 (Ch.20~22)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.20 | 관심사의 분리 | SOLID, Clean Architecture |
| Ch.21 | 테스트를 짜라고 했더니 전부 Mocking입니다 | Unit/Integration/E2E 경계 |
| Ch.22 | 분산 시스템의 기초 | Docker, namespace, cgroup |

### Part 7. 보안과 마무리 (Ch.23~24)

| 챕터 | 제목 | 핵심 |
|------|------|------|
| Ch.23 | 보안은 남의 일이 아니다 | OWASP Top 10, CORS, JWT |
| Ch.24 | 종합 | 전체 키워드 총정리, AI 활용 전략 |

---

## 대상

- 주니어~미들 (0~5년차)
- 월 2회, 챕터당 2~4시간
- GitHub 기반 Tutorial (PPT 아님)

## 키워드 추적

챕터별로 등장하는 CS 키워드는 [키워드 목록](KEYWORDS.md)에서 누적 관리한다.
