# Ch.8 사례: 같은 문제, 다른 카테고리의 키워드

[< 환경 세팅](./README.md) | [OS와 네트워크 키워드 >](./02-os-network-keywords.md)

---

Ch.7에서 "키워드가 프롬프트의 방향을 결정한다"고 했다. 이번에는 한 걸음 더 나간다. 같은 문제라도 어느 카테고리의 키워드를 쓰느냐에 따라 AI의 해법이 완전히 달라진다.


## 8-1. 사례: "API 응답이 느리다"

같은 증상이다. 그런데 원인이 다르면 써야 하는 키워드가 다르다.

### 개발자 A: OS 키워드로 접근

```
API가 느리다. htop을 봤더니 CPU는 여유 있고
strace로 보니 write() system call이 요청당 수백 번 호출된다.
로그 출력(stdout)이 원인인 것 같다.
로그 레벨을 조정하거나 비동기 로깅으로 바꾸는 방법을 알려줘.
```

AI는 logging 모듈의 레벨 조정, 비동기 로깅 핸들러(QueueHandler) 설정 코드를 준다. Ch.2에서 배운 "System Call이 비싸다"가 진단의 출발점이었다.

### 개발자 B: DB 키워드로 접근

```
API가 느리다. SQLAlchemy 로그를 켰더니
같은 SELECT 쿼리가 N번 반복 실행된다.
ORM의 N+1 문제 같다. eager loading으로 바꾸는 방법을 알려줘.
```

AI는 `joinedload()`, `selectinload()` 등 SQLAlchemy의 eager loading 옵션 코드를 준다. Ch.13에서 다루는 "N+1 쿼리 문제"가 진단의 출발점이었다.

### 개발자 C: 네트워크 키워드로 접근

```
API가 느리다. 외부 API를 3개 순차 호출하고 있다.
각각 RTT가 100ms라서 직렬로 부르면 300ms가 된다.
asyncio.gather로 병렬 호출하면 100ms로 줄일 수 있는가?
```

AI는 `aiohttp` + `asyncio.gather`로 외부 API를 병렬 호출하는 코드를 준다. Ch.6에서 배운 "Connection 비용"과 Ch.3에서 배운 "I/O Bound → async"가 진단의 출발점이었다.


## 8-2. 세 접근의 비교

<!-- 기대 키워드: system call, N+1, eager loading, asyncio.gather, RTT -->

| 접근 | 진단 도구 | 핵심 키워드 | 해법 |
|------|----------|------------|------|
| OS | strace, htop | System Call, write(), stdout | 로그 레벨 조정, 비동기 로깅 |
| DB | ORM 쿼리 로그 | N+1, eager loading, JOIN | joinedload, selectinload |
| Network | RTT 측정, 호출 순서 | RTT, 직렬/병렬, asyncio | asyncio.gather |

세 개발자 모두 "API가 느리다"고 시작했다. 그런데 진단 결과가 다르고, 쓴 키워드가 다르고, AI의 해법이 다르다. 어느 것이 정답인가? 전부 정답이다. 원인이 다르니까.

중요한 건, 어느 카테고리의 키워드를 꺼낼 수 있느냐가 진단 능력이라는 거다. "API가 느리다"를 듣고 OS 쪽을 볼 수도, DB 쪽을 볼 수도, 네트워크 쪽을 볼 수도 있어야 한다. 그러려면 각 카테고리의 핵심 키워드를 알고 있어야 한다.

다음부터 카테고리별로 "AI에게 줄 수 있는 핵심 키워드"를 정리한다. 각 키워드가 어떤 상황에서, 어떤 프롬프트에 쓰이는지를 보여주는 게 이 챕터의 목적이다. 전부 외울 필요는 없다. "이런 키워드가 있다"는 걸 알아두면, 문제가 생겼을 때 꺼내 쓸 수 있다.

---

[< 환경 세팅](./README.md) | [OS와 네트워크 키워드 >](./02-os-network-keywords.md)
