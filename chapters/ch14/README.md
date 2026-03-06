# Ch.14 인덱스를 안 걸어놓고 Redis를 설치했습니다

느리면 캐시를 붙인다. 이게 얼마나 많은 팀에서 첫 번째 선택지인지 모른다. 그런데 캐시는 문제를 숨길 뿐, 원인을 제거하지 않는다.

Ch.13에서 ORM이 만드는 SQL을 직접 확인하지 않으면 N+1 같은 문제를 운영에서 발견하게 된다는 걸 봤다. 이번에는 한 발 더 나간다. SQL이 느린 원인 자체를 진단하지 않고 Redis로 도망가면 어떤 일이 벌어지는가.

---

### 목차

1. [사례: 느리니까 Redis 붙였는데 캐시 만료되면 여전히 느리다](./01-case.md)
2. [인덱스 설계의 원리](./02-index-design.md)
3. [유사 사례와 키워드 정리](./03-summary.md)


## 1. 환경 세팅

Ch.13과 동일하다. MySQL + SQLAlchemy 환경에서 EXPLAIN을 적극적으로 활용한다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버 | Ch.13과 동일 |
| FastAPI | 0.111+ | API 서버 | Ch.13과 동일 |
| uvicorn | - | ASGI 서버 | Ch.13과 동일 |
| Docker / MySQL 8.0 | 8.0 | DB | EXPLAIN으로 쿼리 실행 계획을 확인하려면 실제 DB가 필요하다 |
| SQLAlchemy | 2.0+ | ORM + Core | 인덱스 생성과 쿼리 실행을 코드 레벨에서 제어 |

<details>
<summary>EXPLAIN</summary>

Ch.11에서 간단히 다뤘던 그 명령어다. 쿼리가 인덱스를 타는지, Full Table Scan을 하는지, 어떤 경로로 데이터를 찾는지를 보여준다. MySQL에서는 `EXPLAIN SELECT ...` 형태로 사용한다. 이번 챕터에서 EXPLAIN 결과를 해석하는 법을 자세히 다룬다.

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

다음: [사례: 느리니까 Redis 붙였는데 캐시 만료되면 여전히 느리다 >](./01-case.md)
