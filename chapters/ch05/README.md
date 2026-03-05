# Ch.5 동시성 제어의 기초 - Mutex에서 Deadlock까지

Ch.4에서 스레드가 Heap을 공유한다는 걸 확인했다. ThreadPool 16개를 띄워도 메모리가 거의 안 늘어나는 건 이 공유 덕분이었다. 그런데 공유가 좋기만 한 건 아니다. 여러 스레드가 같은 데이터를 동시에 건드리면 데이터가 꼬인다. GIL이 있어도 막아주지 못하는 상황이 있다.

이번 챕터에서는 동시성 문제의 실체를 파고든다.

---

### 목차

1. [사례 A: 재고가 마이너스가 됐는데, 코드 상으로는 불가능한데요?](./01-case-race-condition.md)
2. [왜 이렇게 되는가 - Critical Section과 Lock](./02-critical-section.md)
3. [사례 B: Lock을 걸었더니 서버가 먹통이다](./03-case-deadlock.md)
4. [왜 이렇게 되는가 - Deadlock의 조건과 Semaphore](./04-deadlock-conditions.md)
5. [유사 사례와 키워드 정리](./05-summary.md)


## 1. 환경 세팅

Ch.4와 동일한 환경이다. 추가 설치가 필요 없다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.4와 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.4와 동일 |
| uvicorn | - | ASGI 서버 | Ch.4와 동일 |
| k6 | 최신 | 동시 요청 시뮬레이션 | 여러 VU가 동시에 요청을 보내야 Race Condition이 재현된다 |
| threading (내장) | - | Lock, Semaphore | Python 내장 모듈. 동시성 제어의 기본 도구 |

<details>
<summary>threading.Lock</summary>

Python 내장 `threading` 모듈이 제공하는 상호 배제(Mutex) 잠금이다. `lock.acquire()`로 잠그고 `lock.release()`로 풀거나, `with lock:`으로 자동 관리할 수 있다.
한 번에 하나의 스레드만 Lock을 획득할 수 있다. 다른 스레드가 이미 잡고 있으면, 해제될 때까지 기다린다.
(Java의 `synchronized` 또는 `ReentrantLock`, Go의 `sync.Mutex`와 같은 역할이다.)

</details>

새 도구는 전부 Python 내장이라 별도 설치가 필요 없다.

```bash
cd csbe-study && poetry install
```

서버 실행:

```bash
cd csbe-study/csbe_study && poetry run uvicorn main:app
```

---

다음: [사례 A: 재고가 마이너스가 됐는데, 코드 상으로는 불가능한데요? >](./01-case-race-condition.md)
