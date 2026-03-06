# Ch.13 "JPA를 써서 DB를 모른다고요?" - SQL과 ORM의 관계

ORM은 SQL을 몰라도 DB를 쓸 수 있게 해주는 도구가 아니다. ORM은 SQL을 대신 작성해주는 도구다. "대신 작성해주는 것"과 "몰라도 되는 것"은 전혀 다른 이야기다.

Part 4: 데이터베이스 깊게 보기가 시작된다. Ch.10~12에서 쌓은 자료구조 지식(Hash Table, B-Tree, 시간 복잡도)이 여기서부터 DB로 연결된다.

---

### 목차

1. [사례: ORM이 만든 쿼리 수백 개](./01-case.md)
2. [ORM과 SQL - 왜 SQL을 알아야 하는가](./02-orm-sql.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 1. 환경 세팅

Ch.6에서 사용한 환경과 비슷하다. MySQL + SQLAlchemy를 그대로 쓰되, ORM 기능을 본격적으로 사용한다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.6과 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.6과 동일 |
| uvicorn | - | ASGI 서버 | Ch.6과 동일 |
| Docker / MySQL 8.0 | 8.0 | DB | ORM이 생성하는 SQL을 실제로 확인하려면 DB가 필요하다 |
| SQLAlchemy | 2.0+ | ORM | Python 생태계에서 가장 널리 쓰이는 ORM. Core(raw SQL)와 ORM(모델 기반) 양쪽 다 지원 |

<details>
<summary>ORM (Object-Relational Mapping)</summary>

DB 테이블을 프로그래밍 언어의 클래스(객체)로 매핑하는 기술이다. SQL을 직접 작성하지 않고 객체의 메서드를 호출하면, ORM이 내부적으로 SQL을 생성해서 DB에 보낸다.

Java의 JPA/Hibernate, Python의 SQLAlchemy/Django ORM, Go의 GORM, Node.js의 Prisma/TypeORM 등이 대표적이다.

편리하지만, ORM이 어떤 SQL을 만드는지 모르면 성능 문제를 발견할 수 없다. 이번 챕터의 핵심이 이거다.

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

다음: [사례: ORM이 만든 쿼리 수백 개 >](./01-case.md)
