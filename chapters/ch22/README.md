# Ch.22 분산 시스템의 기초 - Docker부터 시작하자

"내 컴퓨터에서는 되는데요."

개발자가 가장 듣기 싫은 말이고, 동시에 가장 많이 하는 말이다. Ch.20에서 코드 구조를 잡고, Ch.21에서 테스트까지 했다. 이제 서버에 배포하려는데 안 된다. "왜 안 되지? 내 컴퓨터에서는 잘 됐는데?"

이 문제의 원인은 결국 "환경 차이"다. 그리고 이걸 해결하는 기술이 Container다. Docker라는 이름으로 이미 매일 쓰고 있을 거다. 이 강의에서도 Ch.6부터 `docker compose up -d`로 MySQL을 띄워왔다. 그런데 "Docker가 뭔데?"라고 물으면 제대로 답할 수 있는가?

이번 챕터에서는 Docker를 쓰는 법이 아니라, Docker가 어떻게 작동하는지를 파고든다.

---

### 목차

1. [사례: 내 컴퓨터에서는 되는데요](./01-case.md)
2. [Container와 Orchestration](./02-container-orchestration.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 1. 환경 세팅

이번 챕터의 환경은 이미 갖춰져 있다. 이 강의를 따라온 사람이라면 Docker Desktop이 설치되어 있을 거다. Ch.6에서 MySQL을 Docker로 띄운 이후 계속 써왔으니까.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Docker Desktop | 최신 | 컨테이너 실행 | Container의 실체를 직접 확인하기 위해 |
| docker compose | v2+ | 멀티 컨테이너 관리 | 이미 프로젝트에서 쓰고 있다 (MySQL 등) |
| Python | 3.12+ | 서버 | Ch.21과 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.21과 동일 |

<details>
<summary>Docker Desktop</summary>

Docker Engine, Docker CLI, Docker Compose를 묶어서 GUI와 함께 제공하는 데스크탑 애플리케이션이다. macOS와 Windows에서 Linux 컨테이너를 실행할 수 있게 해준다.
macOS에서는 내부적으로 경량 Linux VM(LinuxKit)을 돌리고, 그 위에서 컨테이너를 실행한다. "Docker는 VM이 아니다"라는 말은 맞지만, macOS의 Docker Desktop은 VM 위에서 돌아간다는 아이러니가 있다. 이건 Linux 커널의 namespace/cgroup이 macOS에는 없기 때문이다.

</details>

### Docker 설치 확인

```bash
docker --version
# Docker version 27.x 이상이면 충분하다

docker compose version
# Docker Compose version v2.x 이상
```

### 이미 있는 docker-compose.yml 확인

```bash
cd csbe-study && cat docker-compose.yml
```

Ch.6에서 만든 docker-compose.yml이 이미 MySQL을 정의하고 있다. 이번 챕터에서는 여기에 FastAPI 서버 자체를 컨테이너로 만드는 것까지 확장한다.

---

다음: [사례: 내 컴퓨터에서는 되는데요 >](./01-case.md)
