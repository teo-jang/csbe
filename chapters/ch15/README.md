# Ch.15 Transaction과 Isolation Level

Ch.5에서 Race Condition을 다뤘다. 여러 스레드가 같은 메모리(Heap)에 동시에 접근하면 데이터가 꼬인다는 걸 확인했고, `threading.Lock()`으로 해결했다. 그런데 실무에서 재고, 잔액, 좌석 예약 같은 데이터는 Python 변수가 아니라 DB에 있다. DB에도 같은 문제가 있다. 그리고 DB의 동시성 제어는 스레드 Lock보다 훨씬 복잡하다.

이번 챕터에서는 DB 레벨의 동시성 문제를 파고든다. Transaction이 뭔지, Isolation Level이 왜 4단계나 있는지, 그리고 MySQL InnoDB가 어떤 전략을 택했는지 확인한다.

---

### 목차

1. [사례: 재고가 마이너스가 됐다 - DB 편](./01-case.md)
2. [왜 이렇게 되는가 - Isolation Level](./02-isolation-levels.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 1. 환경 세팅

Ch.6에서 사용한 환경과 거의 동일하다. MySQL과 SQLAlchemy를 그대로 쓴다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.6과 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.6과 동일 |
| uvicorn | - | ASGI 서버 | Ch.6과 동일 |
| k6 | 최신 | 동시 요청 시뮬레이션 | Ch.6과 동일 |
| Docker / MySQL 8.0 (InnoDB) | 8.0 | DB | Transaction과 Isolation Level을 직접 확인하려면 실제 DB가 필요하다 |
| SQLAlchemy + pymysql | 2.0+ | DB 접근 | Transaction 제어를 코드 레벨에서 할 수 있다 |

<details>
<summary>InnoDB</summary>

MySQL의 기본 스토리지 엔진이다. Transaction, Row-level Lock, MVCC(Multi-Version Concurrency Control)를 지원한다. MyISAM은 Table Lock만 지원하고 Transaction이 없다. MySQL 8.0 기준 기본 엔진이 InnoDB이므로, 특별한 설정 없이도 Transaction을 쓸 수 있다.
(PostgreSQL 사용자라면 PostgreSQL은 처음부터 MVCC 기반이라 별도 엔진 선택이 없다.)

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

현재 Isolation Level 확인:

```sql
SELECT @@transaction_isolation;
-- REPEATABLE-READ (MySQL InnoDB 기본값)
```

### 서버 실행

```bash
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```

---

다음: [사례: 재고가 마이너스가 됐다 - DB 편 >](./01-case.md)
