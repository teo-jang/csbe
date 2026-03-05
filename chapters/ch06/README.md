# Ch.6 네트워크 기초 - 3-way handshake를 넘어서

Ch.5에서 Connection Pool의 "최대 동시 접속 수 제한"이 Semaphore라는 걸 확인했다. 그런데 Connection 자체가 뭔지, 왜 만드는 데 비용이 드는지는 이야기하지 않았다. 이번 챕터에서는 Connection의 실체를 파고든다.

---

### 목차

1. [사례: 서버는 살아있는데 요청이 실패한다](./01-case-connection-pool.md)
2. [왜 이렇게 되는가 - TCP/IP와 Socket](./02-tcp-socket.md)
3. [왜 이렇게 되는가 - Connection Pool과 Keep-Alive](./03-connection-pool.md)
4. [유사 사례와 키워드 정리](./04-summary.md)


## 1. 환경 세팅

Ch.5에서 사용한 환경에 MySQL만 추가된다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.5와 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.5와 동일 |
| uvicorn | - | ASGI 서버 | Ch.5와 동일 |
| k6 | 최신 | 동시 요청 시뮬레이션 | Ch.5와 동일 |
| Docker / MySQL 8.0 | 8.0 | DB | Connection의 실체를 보려면 실제 DB가 필요하다 |
| SQLAlchemy + pymysql | 2.0+ | DB 접근 | Connection Pool을 코드 레벨에서 제어할 수 있다 |

<details>
<summary>SQLAlchemy Connection Pool</summary>

SQLAlchemy는 DB Connection을 Pool로 관리한다. 본문에서 자세히 설명한다. Java의 HikariCP, Go의 `database/sql` 내장 Pool과 같은 역할이다.

</details>

### MySQL 기동

```bash
cd csbe-study && docker compose up -d
```

MySQL이 정상적으로 떴는지 확인:

```bash
docker compose ps
# csbe-mysql 컨테이너가 healthy 상태여야 한다
```

### 서버 실행

```bash
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```

---

다음: [사례: 서버는 살아있는데 요청이 실패한다 >](./01-case-connection-pool.md)
