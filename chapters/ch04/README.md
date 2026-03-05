# Ch.4 프로세스와 스레드, 진짜로 이해하고 있는가

Ch.3에서 ProcessPool을 쓰면 CPU Bound 작업이 빨라진다는 걸 확인했다. 그런데 ProcessPool 워커를 마음껏 늘리면 어떻게 되는가? 메모리가 터진다. "프로세스"와 "스레드"가 정확히 뭔지, 메모리에서 어떻게 존재하는지를 모르면 이 문제의 원인조차 추측할 수 없다.

이번 챕터에서는 프로세스와 스레드의 실체를 메모리 구조부터 파고든다.

---

### 목차

1. [사례: ProcessPool을 늘렸더니 메모리가 터졌다](./01-case.md)
2. [CS Drill Down (1) - 메모리에서 프로세스와 스레드는 어떻게 존재하는가](./02-memory-layout.md)
3. [CS Drill Down (2) - Virtual Memory와 OOM](./03-virtual-memory.md)
4. [유사 사례와 키워드 정리](./04-summary.md)


## 1. 환경 세팅

Ch.3까지의 환경에 새로운 도구가 추가된다. 이번 챕터에서는 메모리를 직접 측정해야 하기 때문이다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버, 메모리 측정 | Ch.3와 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.3와 동일 |
| uvicorn | - | ASGI 서버 | Ch.3와 동일 |
| k6 | 최신 | 부하 테스트 | Ch.3와 동일 |
| tracemalloc (내장) | - | Python 메모리 추적 | Python 내장 모듈. Heap 할당을 추적한다 |
| resource (내장) | - | 프로세스 리소스 측정 | Python 내장 모듈. RSS를 측정한다 |

<details>
<summary>tracemalloc</summary>

Python 내장 메모리 추적 모듈이다. `tracemalloc.start()`로 시작하면, 이후 Python이 할당하는 모든 메모리를 추적한다. 어디서 얼마나 메모리를 썼는지 확인할 수 있다.
다만, Python 레벨의 할당만 추적한다. C 확장 모듈이 직접 malloc()으로 잡는 메모리는 보이지 않는다.

</details>

<details>
<summary>resource (Python 모듈)</summary>

Unix 시스템의 프로세스 리소스 사용량을 조회하는 Python 내장 모듈이다. `resource.getrusage(resource.RUSAGE_SELF)`로 현재 프로세스의 메모리 사용량(RSS), CPU 시간 등을 확인할 수 있다.
macOS에서는 `ru_maxrss`가 bytes 단위, Linux에서는 KB 단위다. 플랫폼에 따라 변환이 필요하다.

</details>

<details>
<summary>RSS (Resident Set Size)</summary>

프로세스가 실제로 물리 메모리에 올려놓고 있는 데이터의 크기다. 디스크에 있는 Swap 영역은 포함하지 않는다.
"이 프로세스가 지금 RAM을 얼마나 차지하고 있는가"를 보는 가장 기본적인 지표다. `ps aux`의 RSS 컬럼, 또는 `resource.getrusage()`로 확인할 수 있다.
(Virtual Memory, Swap과의 관계는 이번 챕터에서 자세히 다룬다.)

</details>

새 도구는 전부 Python 내장이라 별도 설치가 필요 없다. 단, `resource` 모듈은 Unix/macOS 전용이다. Windows 환경이라면 WSL2 또는 Docker 컨테이너 안에서 실행해야 한다.

```bash
cd csbe-study && poetry install
```

서버 실행:

```bash
cd csbe-study/csbe_study && poetry run uvicorn main:app
```

---

다음: [사례: ProcessPool을 늘렸더니 메모리가 터졌다 >](./01-case.md)
