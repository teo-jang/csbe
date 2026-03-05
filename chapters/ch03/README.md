# Ch.3 로그를 뺐더니 빨라졌어요? (2) - CPU Bound와 I/O Bound

[< Ch.2 System Call과 커널](../ch02/README.md)

---

Ch.2에서 `print()` 한 줄이 왜 느린지를 확인했다. System Call, 커널까지 왕복하는 비용이었다. print가 느린 건 알겠는데, 그러면 자연스러운 의문이 하나 생긴다.

"I/O가 문제라면, async로 처리하면 되는 거 아닌가?"

결론부터 말한다. async는 만능이 아니다. 작업의 성격을 잘못 파악하고 async를 쓰면, 성능이 나아지기는커녕 오히려 나빠진다. 이번 챕터에서 그걸 직접 증명한다.

---

### 목차

1. [환경 세팅](#1-환경-세팅) (이 페이지)
2. [사례: async로 했는데 왜 안 빨라지지?](./01-case.md)
3. [CS Drill Down (1) - CPU Bound vs I/O Bound](./02-cpu-io-bound.md)
4. [CS Drill Down (2) - GIL과 동시성 전략](./03-concurrency-gil.md)
5. [유사 사례, 실무 대안, 키워드 정리](./04-summary.md)

---

## 1. 환경 세팅

이번 챕터에서 사용할 도구는 다음과 같다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.2와 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.2와 동일 |
| uvicorn | - | ASGI 서버 | Ch.2와 동일 |
| k6 | 최신 | 부하 테스트 | Ch.2와 동일 |
| Pillow | 10.3+ | 이미지 처리 | CPU를 많이 쓰는 작업의 대표 예시. 이미지 변환/회전은 픽셀 단위 연산이라 CPU 집약적이다 |
| MySQL 8.0 | 8.0 | DB | 진짜 네트워크 I/O가 발생하는 DB. 동기(pymysql)/비동기(aiomysql) 두 드라이버로 비교한다 |
| Podman | 최신 | 컨테이너 | MySQL을 로컬에 띄우기 위한 컨테이너 런타임 |

Ch.2에서 쓴 도구가 대부분이다. 새로 추가되는 건 Pillow(이미지 처리)와 MySQL(DB)이다.

<details>
<summary>Pillow</summary>

Python에서 이미지를 다루는 표준 라이브러리다. 이미지 열기, 포맷 변환, 회전, 크기 조절 등을 할 수 있다.
이 강의에서는 "CPU를 많이 쓰는 작업"의 대표 사례로 Pillow의 이미지 변환을 사용한다. 이미지 회전 같은 연산은 모든 픽셀을 하나하나 계산해야 해서, 파일 크기가 클수록 CPU 사용량이 크게 증가한다.

</details>

<details>
<summary>aiomysql</summary>

MySQL을 asyncio 환경에서 사용할 수 있게 해주는 비동기 드라이버다.
일반 pymysql은 동기 방식이라 쿼리 결과가 올 때까지 스레드가 멈추는데, aiomysql은 이 대기 시간 동안 이벤트 루프가 다른 작업을 처리할 수 있다.
SQLAlchemy의 비동기 엔진(`create_async_engine`)과 함께 쓴다.
MySQL은 네트워크 기반 DB라서, 쿼리 실행 시 TCP 통신이 발생한다. 이 네트워크 I/O가 async의 효과를 제대로 보여주는 포인트다.

</details>

### MySQL 준비

MySQL은 Podman 컨테이너로 로컬에 띄운다. `csbe-study/docker-compose.yml`에 설정이 정의되어 있다.

```bash
cd csbe-study

# Podman 컨테이너로 MySQL 기동
podman-compose up -d

# MySQL이 준비될 때까지 잠시 대기 (약 10초)
podman exec csbe-mysql mysqladmin ping -h localhost -u root -pcsbe
```

(Docker를 쓰는 경우 `podman-compose` 대신 `docker compose`를 쓰면 된다.)

<details>
<summary>Podman</summary>

Docker와 호환되는 컨테이너 런타임이다. Docker Desktop 없이도 컨테이너를 실행할 수 있고, rootless 모드를 기본 지원한다.
macOS에서는 `brew install podman` 후 `podman machine init && podman machine start`로 초기 설정을 한다.
docker-compose.yml 파일은 `podman-compose`로 그대로 사용할 수 있다.

</details>

### 서버 실행

```bash
cd csbe-study && poetry install  # 의존성 설치 (Ch.2에서 했으면 생략)

# 서버 실행 (csbe-study/csbe_study 디렉토리에서)
cd csbe_study
poetry run uvicorn main:app
```

---

다음: [사례: async로 했는데 왜 안 빨라지지? >](./01-case.md)
