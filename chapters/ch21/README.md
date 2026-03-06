# Ch.21 테스트를 짜라고 했더니 전부 Mocking입니다

코드를 분리했으면, 제대로 동작하는지 검증해야 한다.

Ch.20에서 God Class를 분해하고, 관심사를 분리하고, 의존성을 주입하는 방법을 배웠다. 코드 구조는 깔끔해졌다. 그런데 한 가지 의문이 남는다. "이 코드가 실제로 동작하는지 어떻게 아는가?"

테스트를 짜면 된다. 그런데 테스트도 잘 짜야 의미가 있다. coverage 90%인데 운영에서 장애가 나는 테스트가 있다. Mock으로 외부 의존성을 전부 대체했더니, 테스트는 통과하는데 실제 동작은 검증하지 못한 거다.

이번 챕터에서는 "어떤 테스트를 짜야 하는가"를 다룬다.

---

### 목차

1. [사례: Mock으로만 통과한 테스트](./01-case.md)
2. [테스트 전략과 경계](./02-test-strategy.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 환경 세팅

Ch.20과 거의 동일한 환경이다. 테스트 도구만 추가된다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.20과 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.20과 동일 |
| pytest | 최신 | 테스트 실행 | Python 테스트 프레임워크의 사실상 표준. unittest보다 간결하고 플러그인 생태계가 크다 |
| unittest.mock | 내장 | Mock/Stub 생성 | Python 내장 모듈. 별도 설치 없이 Test Double을 만들 수 있다 |
| httpx | 최신 | 비동기 HTTP 클라이언트 | FastAPI의 TestClient 대체. async 엔드포인트 테스트에 필요 |

<details>
<summary>pytest</summary>

Python 테스트 프레임워크다. 내장 `unittest`와 달리 클래스 없이 함수만으로 테스트를 작성할 수 있다. `assert` 문을 그대로 쓰면 되고, 실패 시 상세한 diff를 자동으로 보여준다. fixture 시스템이 강력해서 테스트 데이터 관리가 편하다. `pytest-cov`(coverage), `pytest-asyncio`(비동기), `pytest-xdist`(병렬 실행) 등 플러그인이 풍부하다.
(Java의 JUnit, Go의 `testing` 패키지와 같은 역할이다.)

</details>

<details>
<summary>unittest.mock</summary>

Python 내장 모듈로, 테스트에서 실제 객체를 가짜(Mock)로 대체하는 도구를 제공한다. `Mock()`, `MagicMock()`, `patch()` 등이 핵심이다. 외부 API 호출이나 DB 접근을 가짜로 대체해서 테스트 속도를 높이고 외부 의존성을 제거한다. 그런데 이걸 과하게 쓰면, 테스트가 실제 동작을 검증하지 못하게 된다. 이번 챕터의 핵심 주제다.

</details>

### 설치

```bash
cd csbe-study && poetry install
pip install httpx  # TestClient 대체용 (이미 설치돼 있을 수 있다)
```

### 테스트 실행

```bash
cd csbe-study && poetry run pytest -v
```

`-v`는 verbose 모드. 어떤 테스트가 통과/실패했는지 하나씩 보여준다.

---

다음: [사례: Mock으로만 통과한 테스트 >](./01-case.md)
