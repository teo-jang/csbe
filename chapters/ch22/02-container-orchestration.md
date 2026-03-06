# Ch.22 Container와 Orchestration

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 Container의 실체를 확인했다. VM이 아니라 호스트 커널 위에서 돌아가는 격리된 프로세스다. 그런데 "격리"를 어떻게 구현하는 건가? 같은 커널을 쓰는데, 컨테이너 안에서 호스트의 프로세스가 안 보이는 이유는?

Linux 커널의 namespace와 cgroup이다. 이 두 가지가 Container의 전부라고 해도 과언이 아니다.


## namespace: 뭘 볼 수 있는가를 격리한다

namespace는 프로세스가 "무엇을 볼 수 있는가"를 제한하는 Linux 커널 기능이다. 비유하자면 이렇다. 사무실에 칸막이를 치는 거다. 같은 건물(커널) 안에 있지만, 칸막이 너머는 보이지 않는다.

Linux에서 제공하는 namespace는 여러 종류가 있다. 각각이 다른 종류의 자원을 격리한다:

| namespace | 격리 대상 | 컨테이너에서의 효과 |
|-----------|----------|-------------------|
| PID | 프로세스 ID | 컨테이너 안에서 PID 1부터 시작. 호스트 프로세스가 안 보인다 |
| Network | 네트워크 인터페이스, IP, 포트 | 컨테이너가 자체 IP와 포트 공간을 가진다 |
| Mount | 파일 시스템 마운트 | 컨테이너가 자체 파일 시스템을 가진다 |
| UTS | hostname | 컨테이너마다 다른 hostname을 가진다 |
| IPC | IPC 자원 (공유 메모리, 세마포어) | Ch.3에서 다뤘던 IPC 자원이 컨테이너별로 격리된다 |
| User | UID/GID | 컨테이너 안의 root가 호스트에서는 일반 사용자일 수 있다 |

<details>
<summary>namespace (네임스페이스)</summary>

Linux 커널이 프로세스에게 "자원의 뷰"를 격리해서 제공하는 메커니즘이다. 같은 커널 위에서 돌아가지만, namespace가 다른 프로세스들은 서로의 자원을 볼 수 없다. Container의 격리를 구현하는 핵심 기술이다.
(Ch.4에서 프로세스마다 독립적인 메모리 공간을 가진다고 했는데, namespace는 그 격리를 파일 시스템, 네트워크, 프로세스 ID 등으로 확장한 거다.)

</details>

앞에서 봤던 실험 결과를 다시 떠올려보자:

- `ps aux`를 쳤더니 `bash` 하나만 보였다 -> PID namespace가 호스트의 프로세스를 숨긴 거다
- `hostname`이 컨테이너 ID였다 -> UTS namespace가 hostname을 격리한 거다
- `ip addr`에서 다른 IP가 나왔다 -> Network namespace가 네트워크를 격리한 거다

namespace는 "뭘 볼 수 있는가"를 제한한다. 하지만 "얼마나 쓸 수 있는가"는 제한하지 않는다. 컨테이너가 CPU를 100% 점유하거나 메모리를 전부 잡아먹는 걸 막으려면? cgroup이 필요하다.


## cgroup: 얼마나 쓸 수 있는가를 제한한다

cgroup(Control Group)은 프로세스 그룹의 자원 사용량을 제한하는 Linux 커널 기능이다. namespace가 "뭘 볼 수 있는가"라면, cgroup은 "얼마나 쓸 수 있는가"다.

<details>
<summary>cgroup (Control Group)</summary>

Linux 커널이 프로세스 그룹의 CPU, 메모리, 디스크 I/O, 네트워크 대역폭 등의 자원 사용량을 제한하고 모니터링하는 메커니즘이다. Google이 2006년에 개발을 시작했고, 2008년에 Linux 커널에 통합됐다.
Docker는 cgroup으로 컨테이너별 자원 제한을 구현한다. Kubernetes의 `resources.limits`도 결국 cgroup 설정이다.

</details>

cgroup이 제한하는 주요 자원:

| 자원 | Docker 옵션 | 효과 |
|------|-----------|------|
| CPU | `--cpus=2` | 최대 CPU 2코어 사용 |
| Memory | `--memory=512m` | 최대 메모리 512MB 사용 |
| Disk I/O | `--device-read-bps` | 디스크 읽기 속도 제한 |
| PID | `--pids-limit=100` | 최대 프로세스 수 제한 |

### OOM Killer와의 연결

Ch.4에서 OOM(Out of Memory)을 다뤘다. ProcessPool 워커를 16개 띄웠더니 메모리가 1GB를 넘기더니 OOM으로 프로세스가 죽었다.

컨테이너 환경에서는 cgroup의 메모리 제한이 OOM의 직접적인 원인이 된다:

```bash
# 메모리 512MB로 제한
docker run --memory=512m my-app
```

컨테이너 안의 프로세스가 512MB를 초과하면? Linux 커널의 OOM Killer가 컨테이너를 죽인다. Kubernetes에서는 이게 Pod의 `OOMKilled` 상태로 나타난다:

```yaml
# Kubernetes에서 메모리 제한
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"
```

Ch.4에서 "ProcessPool 워커 16개 = 1GB"라는 걸 확인했다. 컨테이너 메모리 제한이 512MB인데 워커를 16개 띄우면? 배포하자마자 OOM으로 죽는다. "왜 Pod이 자꾸 Restart 되는가"의 흔한 원인이 바로 이거다.

(Ch.4에서 봤던 유사 사례 "Docker 컨테이너 메모리 제한"이 기억나는가? 그때는 맛보기였는데, 이제 cgroup이라는 원리를 알게 된 거다.)

정리하면:

- namespace = "뭘 볼 수 있는가" (프로세스, 네트워크, 파일 시스템 등의 격리)
- cgroup = "얼마나 쓸 수 있는가" (CPU, 메모리 등의 제한)
- Container = namespace + cgroup으로 격리된 프로세스

이 두 가지를 합치면 Container가 된다. VM처럼 보이지만, 실체는 커널 기능으로 격리된 프로세스다.


## Docker Image: Layer 구조

Container를 실행하려면 Docker Image가 필요하다. Image는 Container의 "설계도"이자 "스냅샷"이다. 그런데 Image의 내부 구조가 독특하다.

<details>
<summary>Docker Image</summary>

컨테이너를 실행하기 위한 읽기 전용 파일 시스템 패키지다. OS 기본 파일, 라이브러리, 애플리케이션 코드, 설정 파일 등이 포함된다. Dockerfile의 각 명령어가 하나의 레이어를 만들고, 이 레이어들이 겹겹이 쌓여서 Image가 된다.

</details>

<details>
<summary>Layer (레이어)</summary>

Docker Image를 구성하는 읽기 전용 파일 시스템 계층이다. Dockerfile의 각 명령어(FROM, RUN, COPY 등)가 하나의 레이어를 생성한다. 레이어는 캐싱되므로, 이전 레이어가 변경되지 않았으면 다시 빌드하지 않는다.
Union File System(OverlayFS 등)이 여러 레이어를 하나의 파일 시스템처럼 합쳐서 보여준다.

</details>

앞에서 작성한 Dockerfile을 다시 보자:

```dockerfile
FROM python:3.12-slim          # Layer 1: Python 기본 이미지
WORKDIR /app                   # Layer 2: 디렉토리 설정
COPY pyproject.toml poetry.lock ./  # Layer 3: 의존성 파일
RUN pip install poetry && \    # Layer 4: Poetry + 의존성 설치
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction
COPY csbe_study/ ./csbe_study/ # Layer 5: 소스 코드
CMD ["uvicorn", ...]           # 메타데이터 (레이어 아님)
```

각 줄이 하나의 레이어다. 레이어는 이전 레이어 위에 변경 사항만 저장한다. 마치 Git의 커밋처럼.

왜 이렇게 설계했을까? 캐싱 때문이다.

### 레이어 캐싱이 빌드 속도를 결정한다

소스 코드를 한 줄 고치면 Layer 5만 다시 빌드된다. Layer 1~4는 캐시에서 가져온다. 의존성(`pyproject.toml`)이 바뀌지 않았으니까. 빌드 시간이 수 분에서 수 초로 줄어든다.

그래서 Dockerfile에서 "자주 바뀌는 것을 아래에, 덜 바뀌는 것을 위에" 배치하는 게 중요하다:

```dockerfile
# 나쁜 순서: 소스 코드를 먼저 복사하면
COPY . .                       # 소스 코드가 바뀔 때마다
RUN pip install poetry && ...  # 의존성도 다시 설치해야 한다

# 좋은 순서: 의존성 파일을 먼저, 소스 코드를 나중에
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && ...  # 의존성이 안 바뀌면 캐시 사용
COPY csbe_study/ ./csbe_study/ # 소스 코드만 새로 복사
```

### Multi-stage Build: 이미지 크기 줄이기

빌드에 필요한 도구(gcc, make, poetry 등)와 실행에 필요한 파일은 다르다. 빌드 도구까지 이미지에 포함하면 이미지가 불필요하게 커진다.

```dockerfile
# Stage 1: 빌드 환경
FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction

# Stage 2: 실행 환경 (빌드 도구 없이 깔끔하게)
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY csbe_study/ ./csbe_study/
CMD ["uvicorn", "csbe_study.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

최종 이미지에는 Poetry도 없고, 빌드 과정의 임시 파일도 없다. 실행에 필요한 것만 들어 있다.


## Docker vs VM: 성능 차이

말로만 "Container가 가볍다"고 하면 감이 안 오니까, 수치를 보자.

| 항목 | VM (Ubuntu 22.04) | Container (Ubuntu 22.04) | 차이 |
|------|-------------------|-------------------------|------|
| 시작 시간 | ~30초 | ~0.5초 | ~60배 |
| 메모리 오버헤드 | ~500MB (Guest OS) | ~5MB (프로세스만) | ~100배 |
| 디스크 이미지 크기 | ~2GB (OS 전체) | ~80MB (slim) | ~25배 |

출처: Docker 공식 문서, Microsoft Azure Container vs VM 비교 (2023)

(뭐 이 수치가 절대적인 건 아니다. VM 이미지를 최적화하면 훨씬 가볍게 만들 수 있고, Container도 무거운 베이스 이미지를 쓰면 500MB를 넘기기도 한다. 하지만 대략적인 규모감은 이렇다.)

Container가 가벼운 이유는 간단하다. OS를 통째로 올리는 게 아니라, 프로세스 하나를 격리한 것이기 때문이다. 커널은 호스트와 공유하니까 커널 메모리가 추가로 들지 않는다.


## Container가 많아지면: Kubernetes

Container 하나 두 개는 Docker로 충분하다. `docker compose up` 하면 끝이니까. 그런데 서비스가 커지면 이야기가 달라진다.

- 서버가 10대이고, 각 서버에 Container가 20개씩 돌아간다
- Container가 죽으면 자동으로 다시 띄워야 한다
- 트래픽이 늘면 Container를 더 띄우고, 줄면 줄여야 한다
- Container 간 네트워크 통신이 필요하다
- 배포할 때 기존 Container를 하나씩 교체해야 한다 (무중단 배포)

이걸 수동으로 관리하면? 운영자가 지친다. 자동으로 관리해주는 도구가 필요하다. 이걸 Container Orchestration이라 하고, 그 도구가 Kubernetes(K8s)다.

<details>
<summary>Kubernetes (K8s)</summary>

Google이 내부에서 사용하던 Borg 시스템의 경험을 바탕으로 만든 오픈소스 컨테이너 오케스트레이션 플랫폼이다. 2014년에 공개됐고, 현재 CNCF(Cloud Native Computing Foundation)가 관리한다.
Container의 배포, 스케일링, 네트워킹, 장애 복구를 자동화한다. "원하는 상태(Desired State)"를 선언하면, K8s가 현재 상태를 원하는 상태와 일치시키려고 끊임없이 노력한다.
(이름이 길어서 K-u-b-e-r-n-e-t-e-s에서 중간 8글자를 빼고 K8s라고 줄여 쓴다.)

</details>

K8s를 깊이 다루는 건 이 강의의 범위를 벗어난다. 하지만 핵심 개념 세 가지는 알아야 한다. 면접에서도 나오고, 실무에서 매일 마주치니까.

### Pod: Container의 실행 단위

K8s에서 Container를 직접 관리하지 않는다. Pod이라는 단위로 관리한다.

<details>
<summary>Pod (파드)</summary>

Kubernetes에서 배포할 수 있는 가장 작은 단위다. 하나 이상의 Container를 포함한다. 같은 Pod 안의 Container들은 네트워크(IP, 포트)와 저장소를 공유한다.
대부분의 경우 Pod 하나에 Container 하나를 넣는다. 하지만 메인 Container를 보조하는 사이드카 Container(로그 수집, 프록시 등)를 같은 Pod에 넣기도 한다.

</details>

```yaml
# Pod 정의 (보통 직접 만들지 않고 Deployment가 만든다)
apiVersion: v1
kind: Pod
metadata:
  name: csbe-app
spec:
  containers:
    - name: app
      image: csbe-study:latest
      ports:
        - containerPort: 8000
      resources:
        requests:
          memory: "256Mi"
          cpu: "250m"
        limits:
          memory: "512Mi"    # cgroup 메모리 제한
          cpu: "500m"        # cgroup CPU 제한
```

`resources.limits`가 보이는가? 이게 앞에서 다뤘던 cgroup 설정이다. K8s가 이 값을 cgroup에 전달해서 Container의 자원을 제한한다.

### Deployment: Pod를 몇 개 띄울지 관리

<details>
<summary>Deployment (디플로이먼트)</summary>

Pod의 "원하는 상태"를 선언하는 K8s 리소스다. "이 이미지로 Pod을 3개 유지하라"고 선언하면, K8s가 항상 3개를 유지한다. Pod이 죽으면 새로 만들고, 이미지를 업데이트하면 하나씩 교체한다(Rolling Update).

</details>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: csbe-app
spec:
  replicas: 3    # Pod 3개 유지
  selector:
    matchLabels:
      app: csbe
  template:
    metadata:
      labels:
        app: csbe
    spec:
      containers:
        - name: app
          image: csbe-study:latest
          ports:
            - containerPort: 8000
```

`replicas: 3`이면 항상 Pod이 3개 유지된다. Pod 하나가 죽으면? K8s가 자동으로 새 Pod을 만든다. 이미지를 업데이트하면? 기존 Pod을 하나씩 교체하면서 무중단 배포를 한다.

(Ch.19에서 "Replica를 200개로 늘려볼까요?"를 다뤘다. K8s에서는 이 `replicas` 값을 바꾸면 Scale-Out이 된다. 그런데 Ch.19에서 봤듯이, Bottleneck을 안 찾고 replicas만 올리면 돈만 날린다.)

### Service: Pod을 어떻게 찾는가

Pod은 동적으로 생성되고 삭제된다. Pod이 죽으면 새 Pod이 만들어지는데, IP가 바뀐다. 다른 서비스가 이 Pod에 요청을 보내려면 어떻게 해야 하는가?

IP를 직접 쓸 수 없다. Pod이 재시작될 때마다 바뀌니까. 이름으로 찾아야 한다.

<details>
<summary>Service (서비스, K8s)</summary>

Pod 집합에 대한 안정적인 네트워크 엔드포인트를 제공하는 K8s 리소스다. Pod의 IP가 바뀌어도 Service의 DNS 이름과 ClusterIP는 변하지 않는다. 요청을 받으면 label selector에 매칭되는 Pod 중 하나로 라우팅한다.
앞에서 docker-compose에서 서비스 이름(`mysql`)으로 접근한 것과 같은 원리다. K8s에서는 이걸 더 체계적으로 관리한다.

</details>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: csbe-app-svc
spec:
  selector:
    app: csbe     # label이 app=csbe인 Pod에 라우팅
  ports:
    - port: 80
      targetPort: 8000
```

다른 서비스에서 `csbe-app-svc:80`으로 요청을 보내면, K8s가 `app=csbe` label이 붙은 Pod 중 하나로 라우팅해준다. Pod이 죽고 새로 만들어져도, Service 이름은 변하지 않는다.


## Service Discovery: 이름으로 찾는다

Service Discovery는 "서비스의 위치(IP:Port)를 동적으로 찾는 메커니즘"이다. 왜 필요한가?

전통적인 서버 환경에서는 서버 IP가 고정이다. 설정 파일에 `db.host=10.0.0.5`라고 적어놓으면 된다. 그런데 Container 환경에서는:

- Container가 죽으면 새 Container가 만들어진다 (IP가 바뀐다)
- Scale-Out하면 Container가 늘어난다 (여러 IP가 생긴다)
- Scale-In하면 Container가 줄어든다 (IP가 사라진다)

IP를 하드코딩할 수 없다. 이름으로 찾아야 한다.

<details>
<summary>Service Discovery (서비스 디스커버리)</summary>

분산 시스템에서 서비스의 네트워크 위치(IP:Port)를 동적으로 찾는 메커니즘이다. DNS 기반(K8s Service, Consul), 레지스트리 기반(Eureka, etcd), 사이드카 기반(Envoy, Istio) 등 여러 구현 방식이 있다.
Container/K8s 환경에서는 필수다. Pod의 IP가 동적으로 바뀌기 때문에, 이름 기반으로 서비스를 찾을 수 있어야 한다.

</details>

K8s에서 Service Discovery는 DNS 기반으로 동작한다:

```
# 같은 namespace 안에서
csbe-app-svc         -> ClusterIP로 해석
csbe-app-svc:80      -> Pod 중 하나로 라우팅

# 다른 namespace에서
csbe-app-svc.default.svc.cluster.local -> 정규화된 DNS 이름
```

앞에서 docker-compose에서 `DB_HOST: mysql`로 서비스 이름을 쓴 것과 같은 원리다. docker-compose는 내장 DNS로 이걸 처리하고, K8s는 CoreDNS라는 클러스터 DNS 서버가 처리한다.


## 전체 그림: 코드에서 서비스까지

지금까지 다룬 내용을 정리하면 이렇다:

```mermaid
graph LR
    CODE["소스 코드"] -->|"docker build"| IMG["Docker Image<br/>(Layer 구조)"]
    IMG -->|"docker run"| CONT["Container<br/>(namespace + cgroup)"]
    CONT -->|"K8s가 관리"| POD["Pod"]
    POD -->|"Deployment가 복제"| PODS["Pod x N"]
    PODS -->|"Service가 라우팅"| SVC["Service<br/>(DNS 이름)"]
    SVC -->|"외부 접근"| USER["사용자"]
```

1. 코드를 Dockerfile로 빌드하면 Docker Image가 된다
2. Image를 실행하면 Container가 된다 (namespace + cgroup으로 격리된 프로세스)
3. K8s에서 Container는 Pod 단위로 관리된다
4. Deployment가 Pod을 원하는 수만큼 유지한다
5. Service가 DNS 이름을 제공해서, 다른 서비스가 이름으로 찾을 수 있다

이게 현대 백엔드 서비스의 배포 파이프라인이다.

한 가지 강조하고 싶은 게 있다. 이 전체 구조에서 Container의 원리(namespace + cgroup)를 모르면 어떻게 되는가?

- OOM으로 Pod이 죽는데 왜 죽는지 모른다 (cgroup 메모리 제한을 모르니까)
- Container 간 네트워크가 안 되는데 디버깅을 못 한다 (Network namespace를 모르니까)
- Dockerfile을 대충 작성해서 빌드가 10분씩 걸린다 (레이어 캐싱을 모르니까)
- K8s의 resources.limits가 뭔지 모른 채 설정한다 (cgroup과의 관계를 모르니까)

Container의 원리를 모르면 K8s도 제대로 쓸 수 없다.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
