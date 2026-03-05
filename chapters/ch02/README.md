# Ch.2 로그를 뺐더니 빨라졌어요? (1) - System Call과 커널

결론부터 말한다. `print()` 한 줄 찍을 때마다 너의 프로그램은 운영체제의 가장 깊은 곳, 커널까지 다녀온다. 그 왕복 비용이 수천 번 쌓이면 API 응답이 수십 배 느려진다. "로그 좀 빼봐"라는 선배의 말이 감이 아니라 과학이라는 걸, 이번 챕터에서 직접 증명한다.

---

### 목차

1. [환경 세팅](#1-환경-세팅) (이 페이지)
2. [사례: print를 뺐더니 수십 배 빨라졌다](./01-case.md)
3. [CS Drill Down (1) - print()는 어디로 가는가](./02-print-internals.md)
4. [CS Drill Down (2) - System Call이 왜 비싼가](./03-syscall-cost.md)
5. [유사 사례, 실무 대안, 키워드 정리](./04-summary.md)

---

## 1. 환경 세팅

이번 챕터에서 사용할 도구는 다음과 같다.

| 도구 | 버전 | 용도 | 왜 이걸 쓰는가 |
|------|------|------|---------------|
| Python | 3.12+ | 서버, bytecode 분석 | 이 강의의 기본 언어 |
| FastAPI | 0.111+ | 테스트용 API 서버 | 가볍고 빠르다. 비동기 지원도 쉬움 |
| uvicorn | - | ASGI 서버 | FastAPI의 기본 서버 |
| k6 | 최신 | 부하 테스트 | Go로 만들어서 Python 기반 도구(Locust 등)보다 가볍고 강력하다 |
| dis (Python 내장) | - | bytecode 분석 | 설치 없이, 내 코드가 내부적으로 어떻게 변환되는지 바로 볼 수 있다 |

<details>
<summary>k6</summary>

Grafana Labs에서 만든 오픈소스 부하 테스트 도구다.
Go 언어로 작성되어 있어서 Python 기반 부하 테스트 도구(Locust 등)보다 리소스를 적게 먹고, 더 많은 가상 사용자를 시뮬레이션할 수 있다.
테스트 스크립트를 JavaScript로 작성하고, CLI에서 바로 실행한다.
설치: https://grafana.com/docs/k6/latest/set-up/install-k6/

</details>

<details>
<summary>Bytecode (바이트코드)</summary>

사람이 작성한 소스 코드(Python, Java 등)를 컴퓨터가 실행하기 직전 단계로 변환한 중간 코드다.
Python의 경우 `.py` 파일을 실행하면 내부적으로 bytecode로 변환한 뒤, Python 가상 머신(CPython VM)이 이 bytecode를 한 줄씩 해석하며 실행한다.
`__pycache__` 폴더에 `.pyc` 파일로 캐싱되는 게 바로 이 bytecode다.

</details>

설치 확인:

```bash
python3 --version         # Python 3.12+ 확인
cd csbe-study && poetry install  # 의존성 설치
k6 version                # k6 설치 확인
```

`dis` 모듈은 Python 내장이라 별도 설치가 필요 없다. Python이 내 코드를 내부적으로 어떻게 처리하는지(bytecode) 들여다볼 수 있는 도구다.

참고: 이번 챕터의 벤치마크는 서버를 `PYTHONUNBUFFERED=1` 환경에서 실행한다. 이게 뭔지, 왜 필요한지는 [03-syscall-cost.md](./03-syscall-cost.md)의 Buffer 섹션에서 설명한다. 지금은 "벤치마크 결과를 정확하게 만들기 위한 설정"이라고만 알아두면 된다.

---

다음: [사례: print를 뺐더니 수십 배 빨라졌다 >](./01-case.md)
