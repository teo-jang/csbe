# CSBE - Computer Science for Backend Engineer

## 프로젝트 개요

Backend Engineer, MLOps, ML SW Engineer 및 지망생을 위한 CS 강의 자료 저장소.
AI 도구(Claude Code, Cursor 등)를 활용하는 시대에 왜 CS를 알아야 하는지,
"키워드를 모르면 검색도 못 하고 AI도 엉뚱한 답을 준다"는 관점에서 CS를 가르친다.

- 대상: 주니어~미들 (0~5년차)
- 진행: 월 2회, 챕터당 2~4시간
- 형태: GitHub 기반 Tutorial (PPT 아님)
- 언어: 한국어


## 저장소 구조

```
csbe/
  CLAUDE.md              # 이 파일. Claude Code가 참조하는 프로젝트 규칙
  CURRICULUM_DRAFT.md    # 커리큘럼 초안 (참고용)
  README.md              # 저장소 소개
  mkdocs.yml             # MkDocs Material 설정 (GitHub Pages 배포용)
  requirements-docs.txt  # MkDocs 빌드 의존성
  .github/workflows/
    docs.yml             # main push 시 GitHub Pages 자동 배포
  .claude/agents/        # 리뷰어 에이전트 페르소나
    student-beginner.md  # 코딩 경험 있는 비전공자 (CS 열정 높음)
    student-cs.md        # CS 전공 3학년
    junior-dev.md        # 2년차 주니어 백엔드 개발자
  csbe-study/            # 실습 코드 (FastAPI + k6)
    csbe_study/
      main.py
      routers/           # 챕터별 라우터
      model/
      repository/
      service/
    k6/                  # 챕터별 k6 테스트 스크립트
    pyproject.toml       # 의존성 (Poetry)
    docker-compose.yml   # 챕터별 외부 인프라 (MySQL, Redis 등)
  chapters/              # 챕터별 강의 자료 (Markdown)
    index.md             # MkDocs 랜딩 페이지 (전체 커리큘럼 목차)
    KEYWORDS.md          # 키워드 누적 관리
    ch02/
      README.md          # 챕터 소개 + 환경 세팅 + 목차 (랜딩)
      01-case.md         # 사례 (2-1 ~ 2-4)
      02-xxx.md          # CS Drill Down 파트 1
      03-xxx.md          # CS Drill Down 파트 2 (필요 시)
      04-summary.md      # 유사 사례 + 실무 대안 + 키워드 정리
      assets/            # 이미지, 다이어그램 등
    ...
```


## 기술 스택

- Python 3.12+ (pyproject.toml에는 ^3.11로 되어 있지만, 강의 자료에서는 3.12+ 기준)
- Poetry (의존성 관리)
- FastAPI (테스트 서버)
- Black + pre-commit (코드 포매터)
- k6 (부하 테스트, Grafana 제공)
- SQLAlchemy + SQLite/MySQL (DB 실습)
- Pillow (이미지 처리 실습)
- Redis (캐시 실습, 해당 챕터에서)
- Docker + Docker Compose (외부 의존성 일괄 관리)
  - MySQL, Redis, MongoDB 등 챕터별 필요한 인프라를 docker-compose.yml로 제공
  - 수강생이 로컬에 직접 설치할 필요 없이 docker compose up 한 방으로 환경 구성
- MkDocs Material (GitHub Pages 배포, 문서 사이트 빌드)


## 강의 자료 작성 규칙

### 금지 사항

- 이모지 사용 금지
- 굵게(** **) 사용 금지
- AI스러운 말투 금지 (~입니다, ~합니다 체계적 나열)
- Markdown 기반 굵게 표시 금지
- 차트는 mermaid chart 기반으로 작성, 표현이 어려운 경우 텍스트 기반 차트로 대체
- 데이터는 출처를 반드시 표기


### 문체 규칙

- 반말 + 구어체 혼용 (기존 강의 톤 유지)
- "~한다", "~이다" 식의 서술체
- 실무 경험담, 비유, 농담을 자연스럽게 섞는다
- 두괄식으로 작성: 결론/핵심을 먼저 제시하고 상세 설명
- 관련 용어에 대한 상세한 설명을 포함
- 공인된 자료만 사용


### 글쓰기 패턴 (Ground Rule)

Ch.1에서 정립한 글쓰기 패턴이다. 문체 규칙이 "어떤 말투로 쓰는가"라면, 이 섹션은 "어떤 구조로 쓰는가"에 해당한다. 모든 챕터에서 이 패턴을 따른다.

#### 파일 시작 패턴

- 각 파일(README.md 제외)의 첫 문단은 이전 파일 내용을 한 줄로 요약하고, 이번 파일에서 다룰 내용을 선언한다
  - 예: "앞에서 '이해와 경험'의 차이를 이야기했다. 이번에는 ~를 이야기하겠다."
- README.md는 강한 선언문으로 시작한다 (챕터의 핵심 메시지를 한두 문장으로)
  - 예: "이 강의는 CS를 가르치는 강의가 아니다. CS 키워드를 아는 사람과 모르는 사람의 차이를 보여주는 강의다."

#### 질문-답변 흐름

- 독자에게 질문을 던지고, 바로 답하는 구조를 자주 사용한다
- "왜 ~인가?" → 한두 문장으로 핵심 답 → 상세 설명의 3단 구조
  - 예: "왜 JD에는 없는 걸 면접에서 물어보는가?" → "JD는 도구를 묻는 거고, 면접은 문제 해결 능력을 묻는 거다." → 상세 설명
- 독자가 궁금해할 이야기부터 꺼낸다
  - 예: "여러분이 제일 궁금해 할 이야기부터 하겠다."

#### 비교 대조 구조

- 두 가지를 대비시켜 차이를 보여주는 것이 핵심 설득 도구다
- 코드 블록(```)으로 양쪽을 나란히 보여준다 (외운 답변 vs 이해한 답변, 주니어 A vs 주니어 B 등)
- 비교 후 반드시 "차이가 뭔가?" 류의 분석 문장을 넣는다
- A는 키워드를 모르는 사람, B는 아는 사람으로 설정한다. B도 처음부터 정답을 아는 건 아니고, 키워드가 방향을 잡아줬다는 점을 강조한다

#### 괄호 사족

- 본문 흐름을 끊지 않으면서 보충 설명이나 자조적 코멘트를 괄호로 넣는다
  - 보충 설명: "(물론 전혀 그런 기분 안 드는 거 잘 알고 있다.)"
  - 자기 비하 유머: "(이 강의 작성자는 단기 기억에 대한 재능이 거의 없다.)"
  - 다른 언어/기술 사용자를 위한 브릿지: "(Python 사용자라면 비슷한 구조의 함정이 GIL과 asyncio에 있다.)"
- Java/Go 등 다른 언어 사례가 나올 때, Python 사용자를 위한 브릿지를 괄호로 반드시 넣는다

#### 겸손/자기 비하 유머

- 작성자 본인을 낮추는 유머로 권위적이지 않은 톤을 유지한다
  - 예: "면접관인 내가 뭐 그렇게 갑자기 요점을 찌르는 질문을 할 정도로 똑똑한 사람은 아닌데 말이다."
  - 예: "뭐 그렇게 크게 어렵고 위대한 일은 아니지만"
- 반대로, 독자를 깎아내리는 표현은 절대 쓰지 않는다

#### 비유와 메타포

- 추상적 개념을 설명할 때 일상 비유를 쓴다 (축구, 군대, 요리, 공부 등)
  - 예: "골키퍼랑 스트라이커랑 똑같은 훈련을 할 수는 없지 않은가?"
  - 예: "Git rebase를 모르는 것"에 비유
- 비유 후 반드시 본래 개념으로 돌아온다. 비유만 하고 끝내지 않는다

#### 섹션 전환 패턴

- 섹션 사이에 자연스러운 연결 문장을 반드시 넣는다
- 이전 섹션을 한 줄로 정리 → "그런데" 또는 "그래서" → 다음 섹션의 필요성을 제기
  - 예: "의외로 JD에는 CS 이야기가 별로 없는 것 같다. 그런데... 이 간극이 왜 생기는지를 이해하려면, ~를 먼저 구분해야 한다."
- 섹션이 갑자기 시작되는 느낌이 들면 안 된다. 왜 이 주제로 넘어가는지 독자가 자연스럽게 따라와야 한다

#### 섹션 마무리 패턴

- 강한 한 줄 결론으로 섹션을 닫는다
  - 예: "외우는 게 아니다. 연결하는 거다."
  - 예: "이게 CS 키워드를 아느냐 모르느냐의 차이다."
  - 예: "이 강의는 '깊이 이해하는 방법'을 보여주는 강의다."
- 마지막 문장은 짧고 단정적이어야 한다. 길게 설명하지 않는다


### 사례 서술 패턴

강의 자료에서 사례(에피소드)를 서술할 때 따르는 패턴이다.

#### 실무 에피소드

- 구체적 디테일을 넣는다: 연도, 나이/경력, 직급/역할, 기술 스택
- 대사를 직접 인용한다 (큰따옴표 또는 코드 블록)
- 극적 반전 또는 결과를 짧게 서술한다
  - 예: "그대로 코드를 고치자 프로그램이 기적같이 잘 돌아갔다. 일동 경악."
- 에피소드 직후 반드시 핵심 정리를 넣는다: "이 에피소드에서 중요한 건 ~이다" 형태

#### 검색/AI 비교 사례

- "주니어 A / 주니어 B" 또는 "개발자 A / 개발자 B" 대비 구조
- A는 키워드를 모르는 사람, B는 키워드를 아는 사람
- 각각의 검색어 또는 프롬프트를 코드 블록(```)으로 보여준다
- A의 결과는 넓고 애매, B의 결과는 좁고 정확
- B가 처음부터 정답을 알고 있었던 게 아님을 강조한다 (키워드가 방향을 잡아줬을 뿐)

#### 기술 분야 브릿지

- 사례가 특정 분야(임베디드, Java 등)에 한정된 경우, "이거 나한테도 해당되나?" 의문에 대한 브릿지 문단을 반드시 넣는다
  - 예: "'임베디드 이야기라 나한테는 해당 없는 것 아닌가?' 싶을 수 있다. 하지만 같은 구조의 문제는 도처에 있다."
- 백엔드에서의 유사 사례를 짧게 나열해서 연결한다

#### 결론 수렴

- 모든 사례는 해당 챕터의 핵심 메시지로 수렴해야 한다
- Ch.1의 경우 "키워드를 아느냐 모르느냐", Ch.2의 경우 "System Call이 비싸다" 등
- 사례를 나열만 하고 끝내지 않는다. 반드시 "그래서 뭐가 중요한가"로 마무리한다


### 크로스 챕터 참조 규칙

- 다른 챕터에서 다룰 키워드가 등장하면 forward reference를 넣는다
  - 본문: "Ch.N에서 다룬다" 또는 "Ch.N에서 직접 측정해본다"
  - `<details>` 블록 안: "Ch.N에서 ~를 다룰 때 더 자세히 다룬다"
- 이전 챕터를 참조할 때는 "Ch.N에서 ~를 봤다" 또는 "앞에서 말한 ~" 형식
- 같은 파일 내 앞부분을 참조할 때는 "앞에서 ~를 이야기했다" 형식
- forward reference는 독자에게 "지금 전부 이해하지 않아도 된다"는 안심을 준다


### 맛보기 키워드 처리

- 본격적인 기술 챕터가 아닌 경우(Ch.1 등), 다른 챕터의 핵심 키워드를 "맛보기"로 사용할 수 있다
- 맛보기 키워드도 `<details>` 블록으로 간략히 설명하되, 해당 챕터로의 forward reference를 반드시 포함한다
  - 예: "자세한 내용은 Ch.13에서 다룬다."
- 04-summary.md에서 맛보기 키워드와 해당 챕터 고유 키워드를 구분하는 안내 문단을 넣는다
  - 예: "본문에서 맛보기로 언급된 기술 키워드들(~)은 이후 해당 챕터에서 자세히 다룬다. 지금은 '이런 게 있구나' 정도로만 보면 된다."
- 맛보기 키워드는 04-summary.md의 키워드 정리에 포함하지 않는다. 해당 챕터 고유 키워드만 정리한다


### 챕터 파일 구조

하나의 챕터를 단일 README.md에 넣으면 너무 길어진다. 소챕터 파일로 분할한다.

```
chapters/chXX/
  README.md          # 챕터 소개 + 환경 세팅 + 소챕터 목차 (랜딩 페이지)
  01-case.md         # 사례 설명 ~ 코드 설명 (섹션 2-1 ~ 2-4)
  02-xxx.md          # CS Drill Down 파트 1 (섹션 2-5의 전반)
  03-xxx.md          # CS Drill Down 파트 2 (섹션 2-5의 후반, 필요 시)
  04-summary.md      # 유사 사례 + 실무 대안 + 키워드 정리 (섹션 2-6 + 3)
  assets/            # 이미지 등
```

- 파일 수는 내용 양에 따라 유동적이나, 보통 4~5개
- 각 파일 상단/하단에 이전/다음 파일 네비게이션 링크를 반드시 포함
  - 형태: `[< 이전 제목](./이전파일.md) | [다음 제목 >](./다음파일.md)`
- README.md에 전체 목차를 링크로 제공
- CS Drill Down은 논리적으로 끊기는 지점에서 파일을 나눈다
- 파일명은 내용을 반영하는 서술적 이름을 사용한다 (예: `01-why-cs.md`, `02-cs-and-coding.md`)

참고: Ch.1은 예외적 구조를 가진다. 코드/벤치마크 없이 개념과 동기부여 위주로 진행하며, 기본 파일 구조(01-case.md, 02-xxx.md, 03-xxx.md, 04-summary.md) 대신 PPT 원본의 목차 순서를 따른다. Ch.2부터는 기본 파일 구조를 따른다.

### 용어 설명 규칙

CS 용어는 `<details><summary>` 블록으로 설명한다. 두 곳에 넣는다:

1. 본문 inline: 해당 용어가 처음 등장하는 위치 바로 아래에 삽입
2. 챕터 마지막 (04-summary.md): 모든 용어를 모아서 다시 한번 정리

같은 용어의 inline 설명은 챕터 내에서 한 번만 넣는다. 재등장 시 반복하지 않는다.

```markdown
<details>
<summary>용어명 (한국어명)</summary>

설명 본문. 비전공자도 이해할 수 있는 수준으로.
비유나 구체적 예시를 포함한다.
다른 챕터와 연관이 있으면 "Ch.N에서 ~를 다룰 때 더 자세히 다룬다." 형태로 forward reference를 넣는다.

</details>
```

- details 블록 설명 시, 다른 언어 사용자를 위한 비유를 넣으면 좋다
  - 예: "Python의 `threading.Lock()`과 비슷한 역할이라고 보면 된다."
  - 예: "Python의 Coroutine이나 Go의 Goroutine과 비슷한 개념"


### 강의 자료 순서

모든 챕터는 아래 순서를 따른다. 순서가 매우 중요하다.

#### 1. 환경 세팅 (README.md)

- 이번 챕터에서 사용할 환경, 도구, 라이브러리를 명시
- 환경 설치/확인 방법
- 해당 환경을 선택한 이유를 간략히 설명
  - 예: "k6를 쓰는 이유는 go로 만들어서 Python 기반 Locust의 한계를 넘는다"
  - 예: "Black을 쓰는 이유는 opinionated formatter라 논쟁 자체를 없앤다"
- 기존 챕터와 환경이 동일하면 "Ch.XX와 동일" 로 짧게 처리

#### 2. 사례 기반 소개 (01-case.md ~ 03-xxx.md)

이 섹션이 강의의 핵심이다. 아래 하위 순서를 반드시 지킨다.

##### 2-1. 사례 설명
- 실무에서 벌어질 법한 상황을 이야기처럼 서술
- "초보 개발자가 ~를 하고 있다" 식의 시나리오
- 독자가 공감할 수 있는 수준의 구체성

##### 2-2. 사례에 대한 결과 예측
- 독자(청중)에게 질문을 던지는 형태
- "여러분은 어떤 결과가 나올 것 같은가?"
- "몇 배 차이가 날 것 같은가? 그 이유는?"
- 여기서 기대되는 키워드 목록을 주석으로 명시
  - 예: <!-- 기대 키워드: blocking I/O, system call, context switching -->

##### 2-3. 사례에 대한 결과 분석
- 실제 테스트 결과를 수치로 보여준다 (플레이스홀더 금지, 반드시 실측 데이터)
- 표(table) 형태로 비교, 배율 컬럼 포함
- 측정 환경 (머신, Python 버전, 도구 옵션) 명시
- "예상과 다르다면 왜 그런지" 의구심을 유발

##### 2-4. 사례에 대한 코드 설명
- 통상적으로 FastAPI Backend 서버 + k6 기반 스트레스 테스트로 성능을 증명
- 코드 블록으로 서버 코드와 k6 스크립트를 보여준다
- 안 되는 경우에는 별도의 증명 프로세스를 가진다:
  - 웹 페이지에 파일을 올려보는 식
  - FastAPI 서버에 특정 장애를 유발(assert, sleep, 의도적 무한 루프 등)하는 식
- 코드는 csbe-study/ 디렉토리에 실제로 돌아가는 형태로 존재해야 한다

##### 2-5. 왜 이렇게 일어났나 - CS Drill Down (02-xxx.md, 03-xxx.md)
- 위의 사례를 CS 기반으로 파고든다
- 하나의 현상에서 출발해서 관련 CS 개념을 하나씩 풀어간다
- 개념 간의 연결을 보여준다 (연관어 그래프 방식)
- mermaid chart로 개념 간 관계를 시각화
- 논리적으로 끊기는 지점에서 파일을 나눈다 (한 파일이 너무 길어지면 안 됨)
- 섹션 간 전환 문장을 반드시 넣는다 ("~를 확인했다. 그런데 왜 ~인지 다음에서 본다")

##### 2-6. 유사 사례 소개 (04-summary.md)
- 같은 CS 개념이 적용되는 다른 실무 사례를 짧게 소개
- "이런 경우에도 같은 원리가 적용된다"
- 반드시 "그래서 실무에서는 어떻게 하는가" 섹션을 포함 (구체적 대안 코드 제시)

#### 3. 오늘 키워드 정리 (04-summary.md)

- 이번 챕터에서 새로 등장한 키워드를 `<details><summary>` 블록으로 모아서 정리
- 이전 챕터에서 이미 나온 키워드는 별도 표시 (재등장 키워드)
- 키워드 간의 연관 관계를 mermaid chart로 시각화
- 이전 챕터의 키워드 그래프와 겹치는 부분을 표시


### 코드 작성 규칙

- FastAPI 서버 코드는 csbe-study/csbe_study/routers/ 에 챕터별 파일로 작성
- k6 테스트 스크립트는 csbe-study/k6/ 에 챕터별 디렉토리 또는 파일로 작성
- 파일명 규칙: YYMMDD_description.js (k6), 또는 ch{번호}_description.py (router)
- Black 포매팅 준수
- 테스트 코드가 실제로 돌아가는 상태여야 한다
- 코드에 주석은 한국어로 작성


### 벤치마크 규칙

- 결과 표에 플레이스홀더("직접 측정해보자" 등)를 넣지 않는다. 반드시 실측 데이터를 넣는다
- 실측이 불가능한 경우에만 참고 수치를 기입하되, 출처와 환경을 명시
- 측정 환경 (머신, Python 버전, 도구, 옵션)을 표 아래에 기재
- stdout 관련 벤치마크는 `PYTHONUNBUFFERED=1`로 실행해야 터미널 직결(라인 버퍼링) 환경과 동일한 결과가 나온다
  - 백그라운드 실행 시 stdout이 파이프로 가서 풀 버퍼링이 적용되면 결과가 왜곡됨
- 서버 실행 방법: `cd csbe-study/csbe_study && poetry run uvicorn main:app`
  - main.py의 import가 상대 경로(`from routers import printer`)이므로 csbe_study/ 디렉토리에서 실행해야 한다


### GitHub Pages / MkDocs

- MkDocs Material을 사용한다 (mkdocs.yml이 프로젝트 루트에 있음)
- `docs_dir: chapters` 설정으로 chapters/ 디렉토리가 곧 문서 소스
- chapters/index.md가 사이트 랜딩 페이지 (전체 커리큘럼 목차)
- 새 챕터를 추가하면 mkdocs.yml의 nav 섹션에도 추가해야 한다
- `mkdocs serve`로 로컬 프리뷰, main push 시 GitHub Actions가 gh-pages에 자동 배포
- mermaid, `<details><summary>`, 코드 하이라이팅 전부 지원됨


### 리뷰 프로세스

챕터 작성 후 3개의 리뷰어 에이전트를 병렬로 실행해서 자동 검토한다.
에이전트 파일은 `.claude/agents/`에 있다.

| 에이전트 | 페르소나 | 검토 관점 |
|----------|----------|-----------|
| student-beginner | 코딩 경험 있는 비전공자, CS 열정 높음 | 용어 설명 충분성, 논리적 흐름, 비유 적절성 |
| student-cs | CS 전공 3학년 | 기술적 정확성, 출처, 개념 깊이 |
| junior-dev | 2년차 주니어 백엔드 | 실무 적용성, 코드 동작 여부, 실무 대안 |

리뷰 실행: Task 도구로 3개 에이전트를 병렬 실행, 검토 대상 파일 경로를 프롬프트에 명시.
리뷰 결과를 종합해서 강의 자료를 수정한 뒤, 필요하면 다시 리뷰를 돌린다.


## 커리큘럼 (24챕터)

### Part 1. 기초 체력 (Ch.1~6)

#### Ch.1 왜 CS를 공부해야 하는가
- 핵심: CS를 모르면 키워드를 모르고, 키워드를 모르면 검색도 AI 활용도 못 한다
- 사례: JD에 CS가 안 보이는데 왜 면접에서 물어보는가
- 다루는 것: 이해 vs 암기 vs 경험, Computational Thinking, 연관어 학습법
- 에피소드: WORD size를 몰라서 5명이 몇 주간 디버깅한 이야기
- CS 과목: 전체 Overview

#### Ch.2 로그를 뺐더니 빨라졌어요? (1) - System Call과 커널
- 핵심: print문이 왜 느린지 모르면 성능 최적화의 시작점을 찾을 수 없다
- 사례: print문 몇십 개 뺐는데 100배 빨라진 이유
- 다루는 것: bytecode 분석, CPU cycle, User/Kernel Mode, System Call, write()
- 증명: FastAPI doPrint vs dontPrint, k6 벤치마크
- CS 과목: OS, Computer Architecture, 시스템 프로그래밍

#### Ch.3 로그를 뺐더니 빨라졌어요? (2) - CPU Bound와 I/O Bound
- 핵심: 모든 작업을 async로 처리하면 빨라진다는 것은 오해다
- 사례: 이미지 처리를 asyncio로 했는데 오히려 느려짐
- 다루는 것: CPU Bound vs I/O Bound 구분, Context Switching, Blocking I/O
- 증명: sync/async/thread pool/process pool 벤치마크
- CS 과목: OS, PL(GIL), 병렬/분산 시스템

#### Ch.4 프로세스와 스레드, 진짜로 이해하고 있는가
- 핵심: PCB/TCB를 넘어서 메모리 구조까지 알아야 실무 문제를 풀 수 있다
- 사례: OOM이 났는데 왜 났는지 모른다, Stack Overflow가 왜 overflow인지
- 다루는 것: Memory Layout(Stack/Heap/Data/Text), Virtual Memory, Page Fault
- 증명: 메모리 사용량 측정, OOM 재현
- CS 과목: OS, Computer Architecture

#### Ch.5 동시성 제어의 기초 - Mutex에서 Deadlock까지
- 핵심: 동시성 버그는 재현이 어렵기 때문에 원리를 모르면 평생 헤맨다
- 사례: file open을 close 안 하고 종료했더니 파일이 잠긴 이유
- 다루는 것: Race Condition, Mutex, Semaphore, Deadlock 발생 조건
- 증명: 동시성 버그 재현 코드
- CS 과목: OS, 소프트웨어 공학

#### Ch.6 네트워크 기초 - 3-way handshake를 넘어서
- 핵심: Connection이 어떻게 관리되는지 모르면 서버 장애를 이해할 수 없다
- 사례: Connection Refused가 쏟아지는데 서버는 살아있다
- 다루는 것: TCP/IP, Socket(fd 관점), Connection Pool, Keep-Alive, TIME_WAIT
- 증명: netstat/ss로 Connection 상태 관찰, Connection Pool 고갈 재현
- CS 과목: 네트워크, OS(fd)


### Part 2. AI 도구와 CS의 접점 (Ch.7~9)

#### Ch.7 AI가 코드를 짜주는 시대, 왜 CS를 알아야 하는가
- 핵심: 프롬프트에 올바른 CS 키워드가 없으면 AI는 엉뚱한 방향으로 간다
- 사례 모음:
  - 압축을 시켰더니 zlib을 가져다 쓴다. 원한 건 Enum Bit packing
  - "성능 최적화 해줘"라고 했더니 Redis를 설치한다. 문제는 인덱스 미설정
  - 테스트 코드를 짜라고 했더니 전부 Mocking. Integration Test를 원한 건데
- 다루는 것: AI 코딩 도구의 작동 원리, 프롬프트와 키워드의 관계, Do/Don't 전달법
- 증명: 동일 문제에 대해 키워드 없는 프롬프트 vs 키워드 있는 프롬프트 비교
- CS 과목: 전 과목 횡단

#### Ch.8 AI에게 좋은 지시를 내리기 위한 CS 키워드 사전
- 핵심: 카테고리별로 핵심 키워드를 알고 있어야 AI를 정밀하게 제어할 수 있다
- 사례: 같은 문제를 다른 키워드로 지시했을 때 결과 차이
- 다루는 것:
  - OS 키워드: system call, context switching, blocking/non-blocking
  - DB 키워드: index, query plan, isolation level, connection pool
  - Network 키워드: latency, throughput, connection reuse
  - Architecture 키워드: monolith, microservice, event-driven
  - Data Structure 키워드: hash map, B-tree, bloom filter
- 증명: AI 응답 비교 데모
- CS 과목: 전 과목 횡단

#### Ch.9 AI가 만든 코드 리뷰하기 - 뭘 봐야 하는가
- 핵심: AI가 생성한 코드를 CS 관점에서 검증하지 않으면 운영 장애로 이어진다
- 사례: AI가 만든 코드에서 실제로 발견한 문제들
- 다루는 것:
  - AI가 자주 틀리는 패턴 (불필요한 추상화, 과도한 디자인 패턴, 성능 미고려)
  - CS 관점 코드 리뷰 체크리스트 (복잡도, I/O 패턴, 동시성, 에러 핸들링)
- 증명: AI 생성 코드 리뷰 실습
- CS 과목: 소프트웨어 공학, OS, 자료구조


### Part 3. 자료구조와 알고리즘의 실무 (Ch.10~12)

#### Ch.10 contains()를 쓰지 마세요 - 자료구조 선택의 기준
- 핵심: 자료구조 선택은 성능과 당위성을 동시에 고려해야 한다
- 사례: List에서 contains()를 1만 번 호출하는 코드
- 다루는 것: 시간 복잡도의 실무적 의미, List vs Set vs Map, Hash 충돌
- 증명: 자료구조 교체 전후 k6 벤치마크
- CS 과목: 자료구조, 알고리즘

#### Ch.11 정렬과 검색, 그리고 인덱스의 원리
- 핵심: 정렬/검색 알고리즘의 특성을 모르면 DB 인덱스도 이해할 수 없다
- 사례: 10만 건 정렬을 매 요청마다 하는 API
- 다루는 것: Sorting 알고리즘 선택 기준, Binary Search 전제 조건, B-Tree와 Index
- 증명: explain analyze로 인덱스 효과 확인
- CS 과목: 알고리즘, 데이터베이스

#### Ch.12 트리, 그래프, 그리고 실무에서 만나는 구조들
- 핵심: 트리/그래프 구조를 모르면 계층 데이터와 의존성 관리에서 막힌다
- 사례: 카테고리 트리를 매번 재귀로 조회하는 API
- 다루는 것: Binary Tree, B-Tree, Trie, BFS/DFS 실무 활용, DAG
- 증명: 재귀 vs 비재귀 조회 성능 비교
- CS 과목: 자료구조, 알고리즘, 데이터베이스


### Part 4. 데이터베이스 깊게 보기 (Ch.13~16)

#### Ch.13 JPA를 써서 DB를 모른다고요? - SQL과 ORM의 관계
- 핵심: ORM이 생성하는 SQL을 읽을 줄 모르면 N+1 같은 문제를 운영에서 발견하게 된다
- 사례: N+1 문제를 모르고 운영에 올린 이야기
- 다루는 것: ORM이 생성하는 SQL, QEP 읽는 법, CBO 동작 원리
- 증명: ORM 쿼리 로그 분석, QEP 비교
- CS 과목: 데이터베이스

#### Ch.14 인덱스를 안 걸어놓고 Redis를 설치했습니다
- 핵심: 성능 문제의 원인을 정확히 진단하지 않으면 엉뚱한 해결책을 적용하게 된다
- 사례: 느리다고 Redis 붙였는데 실제 원인은 인덱스 미설정
- 다루는 것: Index 작동 원리(B-Tree, Hash), Covering Index, Index 안티패턴
- 증명: 인덱스 유무에 따른 쿼리 성능 차이 측정
- CS 과목: 데이터베이스, 자료구조

#### Ch.15 Transaction과 Isolation Level
- 핵심: 동시 요청 환경에서 데이터 정합성을 지키려면 Isolation Level을 이해해야 한다
- 사례: 동시 주문에서 재고가 마이너스가 된 이유
- 다루는 것: ACID, Isolation Level 4단계, Phantom/Dirty/Non-repeatable Read
- 증명: Isolation Level별 동시성 문제 재현
- CS 과목: 데이터베이스, OS(동시성)

#### Ch.16 DB 성능 튜닝의 실무
- 핵심: Slow Query 하나가 전체 DB를 먹통으로 만들 수 있다
- 사례: Slow Query가 Connection Pool을 고갈시킨 이야기
- 다루는 것: Connection Pool 사이징, 서브쿼리 vs JOIN vs EXISTS, Partitioning/Sharding
- 증명: Slow Query 분석과 개선 전후 비교
- CS 과목: 데이터베이스, 네트워크


### Part 5. 캐시와 성능 최적화 (Ch.17~19)

#### Ch.17 느리니까 Redis 붙이고 생각해볼까요?
- 핵심: 캐시는 만능이 아니며, 잘못 적용하면 오히려 장애를 유발한다
- 사례: Cache를 붙였는데 오히려 장애가 난 이유 (Cache Stampede)
- 다루는 것: Cache Hit Rate, Write-Through/Write-Back/Cache Aside, TTL, Eviction
- 증명: Redis 기반 캐시 적용 전후 벤치마크
- CS 과목: 데이터베이스, 분산 시스템

#### Ch.18 Local Cache vs Remote Cache vs 계층 캐시
- 핵심: 캐시도 계층 구조로 설계해야 최적의 성능을 낼 수 있다
- 사례: 도로명 주소를 매번 Redis에서 가져오는 코드
- 다루는 것: Local/Remote Cache 장단점, Cache Invalidation, CDN
- 증명: 계층 캐시 구조 설계와 성능 비교
- CS 과목: 데이터베이스, 네트워크, Computer Architecture(CPU Cache 비유)

#### Ch.19 성능이 안 나오네, Replica를 200개로 늘려볼까요?
- 핵심: Bottleneck을 찾지 않고 Scale-Out하면 돈만 날린다
- 사례: Scale-Out 했는데 성능이 안 오르는 이유
- 다루는 것: Bottleneck 식별(CPU/Memory/I/O/Network), Amdahl's Law, 성능 측정 도구
- 증명: k6 + Prometheus/Grafana로 Bottleneck 식별 실습
- CS 과목: OS, 분산 시스템, 네트워크


### Part 6. 소프트웨어 설계와 아키텍처 (Ch.20~22)

#### Ch.20 소프트웨어 공학의 핵심 - 관심사의 분리
- 핵심: 코드가 커질수록 관심사 분리 없이는 유지보수가 불가능하다
- 사례: 3000줄짜리 God Class가 된 Service 레이어
- 다루는 것: SOLID 원칙의 실무적 의미, DI/IoC, Clean/Hexagonal Architecture
- 증명: 스파게티 코드 리팩토링 전후 비교
- CS 과목: 소프트웨어 공학

#### Ch.21 테스트를 짜라고 했더니 전부 Mocking입니다
- 핵심: Mocking만 가득한 테스트는 실제 동작을 검증하지 않는다
- 사례: Mock으로만 통과한 테스트가 운영에서 터진 이야기
- 다루는 것: Unit/Integration/E2E Test 경계, Test Double 종류, 테스트 피라미드
- 증명: Integration Test 작성과 Mock 최소화 실습
- CS 과목: 소프트웨어 공학

#### Ch.22 분산 시스템의 기초 - Docker부터 시작하자
- 핵심: Container의 원리를 모르면 K8s도 제대로 쓸 수 없다
- 사례: "내 컴퓨터에서는 되는데요"
- 다루는 것: namespace, cgroup, Docker vs VM, K8s 기본 개념, Service Discovery
- 증명: Docker Compose로 멀티 서비스 환경 구성
- CS 과목: OS, 네트워크, 분산 시스템


### Part 7. 보안과 마무리 (Ch.23~24)

#### Ch.23 보안은 남의 일이 아니다
- 핵심: 보안 취약점은 CS를 모르면 왜 위험한지조차 이해할 수 없다
- 사례: XSS 한 줄로 서비스가 털린 이야기
- 다루는 것: OWASP Top 10, CORS/CSRF/SQL Injection, HTTPS/TLS, JWT vs Session
- 증명: 취약점 재현과 방어 코드 작성
- CS 과목: 보안, 네트워크

#### Ch.24 종합 - 내가 만든 서비스를 처음부터 끝까지 분석하기
- 핵심: 24챕터의 키워드를 하나의 서비스에 매핑해서 전체 그림을 완성한다
- 사례: 하나의 서비스를 설계-구현-배포-운영 관점에서 분석
- 다루는 것: 전체 키워드 총정리, 레이어별 CS 매핑, AI 활용 전략
- 증명: 종합 프로젝트 분석
- CS 과목: 전 과목 횡단


## 키워드 추적 규칙

각 챕터에서 등장하는 키워드는 누적 관리한다.

- 새 키워드: 해당 챕터에서 처음 등장하는 CS 개념
- 재등장 키워드: 이전 챕터에서 이미 다뤘고 이번에 다시 연결되는 개념
- 키워드 그래프: mermaid chart로 챕터별 키워드 간 연관 관계를 시각화
- 누적 키워드 목록은 chapters/KEYWORDS.md 에서 관리


## 작성자 정보

- Teo Jang
- SW Maestro 멘토
- 컨텐츠 대기업 ML 총괄 (연구팀, 개발팀, Ops팀 보유)
- 제 123회 정보관리기술사
- 펌웨어(DSP, device driver, BSP, kernel)부터 AI/HPC까지 전 레이어 경험
