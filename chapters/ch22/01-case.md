# Ch.22 사례: 내 컴퓨터에서는 되는데요

[< 환경 세팅](./README.md) | [Container와 Orchestration >](./02-container-orchestration.md)

---

Ch.21에서 테스트까지 마쳤다. Unit Test, Integration Test 전부 통과한다. 이제 배포할 일만 남았다. 그런데 배포하면 안 된다. "내 컴퓨터에서는 되는데요."

이 말이 나오는 근본적인 원인은 환경 차이다. 그리고 이 문제를 해결하는 기술이 Container다. Container가 대체 뭔지, VM이랑 뭐가 다른지를 이번에 확인한다.


## 22-1. 사례 설명

2년차 백엔드 개발자가 Python FastAPI 서비스를 개발하고 있다. 로컬 환경은 이렇다:

- macOS, Python 3.11
- MySQL 8.0 (Docker로 실행)
- Redis 7.0 (Docker로 실행)

개발 완료. 로컬 테스트 통과. staging 서버에 배포했다. 서버 환경은 이렇다:

- Ubuntu 22.04, Python 3.9 (서버에 기본 설치된 버전)
- MySQL 5.7 (운영팀이 관리하는 공용 DB)
- Redis 미설치

배포 직후 에러가 쏟아진다.

```
# 에러 1: Python 문법 에러
SyntaxError: cannot use match statement (Python 3.10+ 전용)

# 에러 2: MySQL 호환 문제
OperationalError: (1064) You have an error in your SQL syntax
# MySQL 8.0의 Window Function을 썼는데 5.7에서는 지원하지 않는다

# 에러 3: Redis 연결 실패
ConnectionError: Error connecting to redis://localhost:6379
```

"내 컴퓨터에서는 됐는데?"

당연히 됐다. Python 3.11이 깔려 있고, MySQL 8.0을 쓰고 있고, Redis도 돌아가고 있으니까. 서버 환경이 다르다는 걸 몰랐거나, 알았어도 "설마 문제가 되겠어?"라고 생각한 거다.

이 에피소드에서 중요한 건 세 가지다:

1. 개발 환경과 운영 환경이 다르면 "동작하는 코드"가 "동작하지 않는 코드"가 된다
2. Python 버전, DB 버전, 의존성 패키지 버전, OS까지 전부 환경이다
3. "내 컴퓨터에서 됐다"는 말은 "내 환경에서 됐다"는 뜻이지 "어디서든 된다"는 뜻이 아니다

해결 방법은 간단하다. 환경 자체를 코드로 정의하고, 어디서든 같은 환경을 재현할 수 있게 만들면 된다. 이게 Docker가 하는 일이다.

<details>
<summary>Docker</summary>

컨테이너를 빌드하고 실행하는 도구의 사실상 표준이다. 2013년 Solomon Hykes가 발표했다. "Build, Ship, Run" - 어디서든 같은 환경으로 실행할 수 있다는 게 핵심 가치다.
Dockerfile이라는 텍스트 파일에 환경을 정의하고, `docker build`로 이미지를 만들고, `docker run`으로 컨테이너를 실행한다.
(Java의 "Write Once, Run Anywhere"와 비슷한 철학이지만, 언어 수준이 아니라 OS 수준에서 해결한다.)

</details>


## 22-2. 결과 예측

Docker로 환경을 통일하면 문제가 해결된다. 그건 대부분 알고 있을 거다. 그런데 Docker가 대체 어떻게 작동하는 걸까?

여기서 질문을 던진다.

- "Docker 컨테이너 안에서 `ps aux`를 치면 프로세스가 몇 개 보이는가? 호스트의 프로세스도 보이는가?"
- "Docker 컨테이너 안에서 `hostname`을 치면 뭐가 나오는가? 호스트의 hostname인가?"
- "컨테이너는 VM인가? VM이 아니라면, 뭐가 다른가?"
- "컨테이너를 100개 띄우면 VM 100개 띄운 것만큼 무거운가?"

<!-- 기대 키워드: Container, Process, namespace, cgroup, VM, Hypervisor -->


## 22-3. 결과 분석

직접 확인해보자. 이미 Docker Desktop이 설치되어 있으니까 바로 실행할 수 있다.

### 컨테이너 안에서 프로세스 확인

```bash
# Ubuntu 컨테이너를 하나 띄운다
docker run -it --rm ubuntu:22.04 bash
```

컨테이너 안에서:

```bash
# 프로세스 목록
ps aux
# USER  PID  %CPU  %MEM  COMMAND
# root    1   0.0   0.0  bash
```

프로세스가 1개다. `bash` 하나. 호스트의 수백 개 프로세스가 보이지 않는다. 그리고 PID가 1이다. 호스트에서 PID 1은 `init`(또는 `systemd`)인데, 컨테이너 안에서는 `bash`가 PID 1이다.

```bash
# hostname 확인
hostname
# a3f2e8b1c4d5 (무작위 컨테이너 ID)
```

호스트의 hostname이 아니라, 컨테이너 고유의 hostname이 나온다.

```bash
# 네트워크 확인
ip addr
# eth0: 172.17.0.2/16
```

호스트와는 다른 IP 주소를 가지고 있다.

이걸 보면 "VM 아닌가?" 싶다. 별도의 프로세스 공간, 별도의 hostname, 별도의 네트워크. 마치 독립적인 서버처럼 보인다.

그런데 VM이 아니다.

### Container vs VM: 핵심 차이

호스트에서 컨테이너의 프로세스를 확인해보자. 컨테이너를 띄운 상태에서 다른 터미널에서:

```bash
# 호스트에서 docker 프로세스 확인
docker top <container_id>
# UID   PID   PPID  CMD
# root  12345  6789  bash
```

호스트에서 보면, 컨테이너 안의 `bash`는 그냥 호스트의 프로세스 중 하나다. PID 12345. 호스트의 `ps aux`에서도 보인다. 컨테이너 안에서는 PID 1이었지만, 호스트에서는 PID 12345인 것이다.

이게 Container와 VM의 근본적인 차이다.

| | VM | Container |
|--|------|-----------|
| 실체 | 독립적인 OS를 포함한 가상 머신 | 호스트 OS의 프로세스를 격리한 것 |
| 커널 | Guest OS 커널이 별도로 존재 | 호스트 커널을 공유 |
| 부팅 시간 | 수십 초~수 분 (OS 부팅) | 수백 ms (프로세스 시작) |
| 메모리 오버헤드 | 수백 MB~수 GB (Guest OS) | 수 MB~수십 MB (프로세스 + 라이브러리) |
| 격리 수준 | 높음 (하드웨어 가상화) | 중간 (커널 공유) |
| 밀도 | 서버당 수십 개 | 서버당 수백~수천 개 |

<details>
<summary>VM (Virtual Machine)</summary>

물리 서버 위에 Hypervisor(VMware, VirtualBox, KVM 등)를 올리고, 그 위에 Guest OS를 통째로 설치하는 방식이다. 각 VM은 자체 커널, 자체 Init 프로세스, 자체 드라이버를 가진다. 완전한 격리를 제공하지만, 그만큼 무겁다.
Ch.4에서 "프로세스마다 독립적인 메모리 공간"을 다뤘는데, VM은 그걸 더 극단적으로 밀어붙인 거다. 프로세스 격리가 아니라 OS 격리.

</details>

<details>
<summary>Container (컨테이너)</summary>

호스트 OS의 커널을 공유하면서, 프로세스를 격리하는 기술이다. 별도의 OS를 설치하지 않는다. Linux 커널의 namespace와 cgroup이라는 기능으로 프로세스를 격리하고 자원을 제한한다.
"Container는 프로세스다." 이 한 문장이 핵심이다. VM처럼 보이지만, 실체는 호스트에서 돌아가는 격리된 프로세스다.

</details>

<details>
<summary>Hypervisor (하이퍼바이저)</summary>

VM을 생성하고 관리하는 소프트웨어다. 물리 하드웨어와 Guest OS 사이에 위치한다. Type 1(Bare-metal: ESXi, KVM)은 하드웨어 위에 직접 설치하고, Type 2(Hosted: VirtualBox, VMware Workstation)는 호스트 OS 위에서 실행된다.
Container에는 Hypervisor가 필요 없다. 커널의 namespace/cgroup만으로 격리를 구현하기 때문이다.

</details>

정리하면:

- VM은 "OS를 통째로 가상화"한다. 커널까지 별도로 가진다
- Container는 "프로세스를 격리"한다. 커널은 호스트와 공유한다

이게 왜 중요한가? Container가 가볍기 때문이다. VM 하나 띄우면 수백 MB의 메모리가 필요하고 부팅에 수십 초가 걸린다. Container는 수 MB에 수백 ms다. 서버에 VM은 수십 개 올릴 수 있지만, Container는 수백~수천 개를 올릴 수 있다.

"그런데 프로세스를 어떻게 '격리'하는 건데? 같은 커널을 공유하는데, 컨테이너 안에서 호스트의 프로세스가 안 보이는 이유는?"

namespace다. 다음에서 자세히 본다.


## 22-4. 코드 설명

이 프로젝트에 이미 docker-compose.yml이 있다. Ch.6에서 MySQL을 띄울 때 만든 것이다:

```yaml
version: "3.8"

services:
  mysql:
    image: mysql:8.0
    container_name: csbe-mysql
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_ROOT_PASSWORD: csbe
      MYSQL_DATABASE: csbe_study
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 3s
      retries: 10
```

이걸 `docker compose up -d`로 실행하면 MySQL 8.0 컨테이너가 뜬다. "내 컴퓨터에서는 됐는데"의 MySQL 버전 문제를 해결한 거다. 로컬이든 서버든, 이 docker-compose.yml만 있으면 같은 MySQL 8.0을 쓸 수 있다.

그런데 서버 코드 자체도 컨테이너로 만들면 Python 버전 문제까지 해결된다. Dockerfile을 작성해보자.

### Dockerfile: 환경을 코드로 정의한다

```dockerfile
# Python 3.12 베이스 이미지
FROM python:3.12-slim

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일만 먼저 복사 (캐싱 최적화)
COPY pyproject.toml poetry.lock ./

# Poetry 설치 및 의존성 설치
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction

# 소스 코드 복사
COPY csbe_study/ ./csbe_study/

# 서버 실행
CMD ["uvicorn", "csbe_study.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

<details>
<summary>Dockerfile</summary>

Docker 이미지를 만들기 위한 텍스트 파일이다. `FROM`으로 베이스 이미지를 지정하고, `RUN`으로 명령을 실행하고, `COPY`로 파일을 복사하고, `CMD`로 컨테이너 시작 시 실행할 명령을 정의한다.
각 명령어가 하나의 "레이어"를 만든다. 레이어는 캐싱되므로, 변경되지 않은 레이어는 다시 빌드하지 않는다. 이 레이어 구조가 Docker 이미지의 핵심 설계이고, 02-container-orchestration.md에서 자세히 다룬다.

</details>

이 Dockerfile이 있으면:

```bash
# 이미지 빌드
docker build -t csbe-study .

# 컨테이너 실행
docker run -p 8000:8000 csbe-study
```

어디서 실행하든 Python 3.12, 동일한 의존성, 동일한 코드가 실행된다. "내 컴퓨터에서는 되는데"가 불가능해진다. 환경이 Dockerfile에 고정되어 있으니까.

### docker-compose.yml 확장: 서버 + DB를 한 번에

```yaml
version: "3.8"

services:
  mysql:
    image: mysql:8.0
    container_name: csbe-mysql
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_ROOT_PASSWORD: csbe
      MYSQL_DATABASE: csbe_study
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 3s
      retries: 10

  app:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DB_HOST: mysql  # 컨테이너 이름으로 접근 가능
      DB_PORT: 3306
```

`docker compose up` 한 방이면 MySQL과 FastAPI 서버가 같이 뜬다. 새로 합류한 팀원도 이 명령 하나로 전체 개발 환경을 구성할 수 있다.

여기서 주목할 점: `DB_HOST: mysql`. 서버 코드에서 DB 접속 주소를 `localhost:3306`이 아니라 `mysql:3306`으로 쓴다. docker-compose는 서비스 이름(`mysql`)을 DNS 이름으로 등록해준다. 같은 docker-compose 네트워크 안에서는 서비스 이름으로 서로를 찾을 수 있다.

이 "이름으로 찾는" 기능이 바로 Service Discovery의 가장 기본적인 형태다. Ch.6에서 IP 주소와 포트로 Connection을 만든다고 했는데, 컨테이너 환경에서는 IP가 동적으로 바뀐다. 그래서 이름 기반의 Service Discovery가 필수다. 이건 다음 파일에서 자세히 다룬다.

Container가 프로세스 격리라는 건 확인했다. 그런데 "어떻게" 격리하는 건지, namespace와 cgroup이 정확히 뭔지, Docker Image의 레이어 구조는 어떻게 되는지, 그리고 컨테이너가 많아지면 어떻게 관리하는지를 다음에서 파고든다.

---

[< 환경 세팅](./README.md) | [Container와 Orchestration >](./02-container-orchestration.md)
