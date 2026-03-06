# Ch.20 소프트웨어 공학의 핵심 - 관심사의 분리

성능은 잡았다. 그런데 코드가 3,000줄짜리 God Class인 건 어떻게 할 건가?

Part 5에서 쿼리를 고치고, 캐시를 붙이고, Bottleneck을 찾아서 성능을 최적화했다. 그런데 성능이 아무리 좋아도 코드를 유지보수할 수 없으면 서비스는 결국 무너진다. 기능 하나 추가하면 버그가 세 개 생기고, 한 줄 고치려면 3,000줄 전체를 이해해야 한다. 이번 챕터에서는 그 문제의 원인과 해결 방법을 다룬다.

---

### 목차

1. [사례 - 3000줄짜리 God Class](./01-case.md)
2. [SOLID와 Clean Architecture](./02-solid-architecture.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 1. 환경 세팅

Ch.19와 동일한 환경이다. 추가 설치가 필요 없다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.19와 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.19와 동일 |
| uvicorn | - | ASGI 서버 | Ch.19와 동일 |

이번 챕터는 성능 측정이 핵심이 아니다. 코드 구조를 비교하는 챕터다. k6나 Docker가 필요 없다. Python과 FastAPI만 있으면 된다.

```bash
cd csbe-study && poetry install
```

서버 실행:

```bash
cd csbe-study/csbe_study && poetry run uvicorn main:app
```

---

다음: [사례 - 3000줄짜리 God Class >](./01-case.md)
