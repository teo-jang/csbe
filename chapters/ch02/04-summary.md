# Ch.2 유사 사례, 실무 대안, 키워드 정리

[< System Call이 왜 비싼가](./03-syscall-cost.md)

---

지금까지 `print()` 한 줄이 System Call과 모드 전환이라는 무거운 작업을 유발한다는 걸 확인했다. 같은 원리가 적용되는 다른 사례를 보고, 실무에서 어떻게 대응하는지 정리하겠다.


## 2-6. 유사 사례 소개

### logging 모듈도 예외가 아니다

Python의 `logging` 모듈은 `print()` 대신 쓰라고 만들어진 도구다. 그런데 이것도 결국 내부적으로 `StreamHandler`가 `sys.stderr`에 `write()`를 호출한다. System Call이 발생한다는 점에서는 `print()`와 다를 게 없다.

문제는 로그 레벨 설정이다. 개발 중에 편하다고 DEBUG 레벨로 설정해두고 그 상태로 운영에 나가면, 모든 디버그 메시지가 I/O를 유발한다. print()를 수천 개 넣은 것과 다를 바 없는 상황이 되는 거다.

### ORM 쿼리 로그

SQLAlchemy나 JPA 같은 ORM에는 "실행되는 SQL을 로그로 찍어주는" 옵션이 있다. 개발 중에는 디버깅에 유용하다. 그런데 이걸 운영 환경에서 켜두면? 매 쿼리마다 SQL 문이 stdout이나 로그 파일에 쓰인다. 쿼리가 초당 수백~수천 건이면, 그만큼의 `write()` System Call이 추가로 발생한다.

"쿼리 로그 끄니까 DB 부하가 줄었다"는 이야기를 가끔 듣는데, 실제로는 DB 부하가 아니라 애플리케이션 서버의 I/O 부하가 줄어든 경우가 많다.

### 파일 쓰기도 같은 구조다

`open()` + `write()`로 파일에 쓰는 것도 결국 `write()` System Call이다. 다만 파일은 보통 풀 버퍼링이 적용되어서, 줄바꿈마다 flush하는 `print()`만큼 System Call이 잦지는 않다. 그래도 "파일에 쓰는 행위 = System Call"이라는 본질은 같다.

### 언어가 달라도 원리는 같다

Java의 `System.out.println()`, Go의 `fmt.Println()`, Node.js의 `console.log()`. 언어가 달라도 운영체제 위에서 돌아가는 한, "화면에 뭔가를 출력하는 행위"는 System Call을 동반한다. System Call은 공짜가 아니다. 이건 특정 언어의 문제가 아니라 OS의 구조적 특성이다.


## 그래서 실무에서는 어떻게 하는가

"print가 느리다는 건 알겠는데, 그러면 로그를 아예 안 찍으라는 건가?"

아니다. 로그를 없애라는 게 아니라, 제어하라는 거다.


### 1. 로그 레벨로 출력을 제어한다

```python
import logging

# 이것만 해두면 WARNING 이상만 출력된다
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# 개발 중에는 이렇게 쓰고
logger.debug("디버깅용 메시지")  # 운영에서는 출력 안 됨

# 중요한 건 이렇게
logger.warning("이건 운영에서도 출력됨")
```

`logging` 모듈을 쓰면 로그 레벨로 출력을 제어할 수 있다. 개발 환경에서는 DEBUG로 전부 보고, 운영 환경에서는 WARNING 이상만 출력하도록 설정하면, 불필요한 System Call을 원천 차단할 수 있다.

핵심 전략은 이거다:

| 환경 | 로그 레벨 | 이유 |
|------|----------|------|
| 개발(local) | DEBUG | 디버깅에 필요한 모든 정보를 본다 |
| 스테이징(staging) | INFO | 흐름 추적은 하되 디버그 노이즈는 뺀다 |
| 운영(production) | WARNING 이상 | 문제가 생겼을 때만 로그가 나온다 |


### 2. 비동기 로깅으로 블로킹을 줄인다

`logging` 모듈의 기본 핸들러는 동기(synchronous) 방식이다. 로그를 쓸 때마다 `write()` System Call이 완료될 때까지 기다린다. 요청 처리 중에 로그가 많으면 그만큼 응답이 느려진다.

Python 3.2+에서는 `QueueHandler`와 `QueueListener`를 제공한다. 로그 메시지를 큐에 넣기만 하고, 별도 스레드에서 실제 I/O를 처리하는 방식이다. (스레드는 Ch.4에서 자세히 다룬다. 지금은 "로그 쓰는 작업을 다른 곳에 맡기는 구조"라고만 알아두면 된다.)

```python
import logging
from logging.handlers import QueueHandler, QueueListener
from queue import Queue

# 큐 기반 비동기 로깅 설정
log_queue = Queue()
queue_handler = QueueHandler(log_queue)

# 실제 출력은 별도 스레드에서
stream_handler = logging.StreamHandler()
listener = QueueListener(log_queue, stream_handler)
listener.start()

logger = logging.getLogger(__name__)
logger.addHandler(queue_handler)
```

이러면 요청 처리 스레드는 큐에 메시지를 넣기만 하고(메모리 조작, 빠르다) 바로 다음 작업으로 넘어간다. `write()` System Call은 별도 스레드에서 처리된다.


### 3. print()는 디버깅 도구다

`print()`는 디버깅 도구다. 운영 코드에 남기는 게 아니다. 용도에 맞는 도구를 쓰자.

| 도구 | 용도 | System Call 제어 |
|------|------|----------------|
| `print()` | 개발 중 즉석 디버깅 | 불가 (매번 발생) |
| `logging` | 운영 환경 로그 | 레벨로 제어 가능 |
| `logging` + `QueueHandler` | 고성능 운영 환경 | 비동기 처리로 블로킹 최소화 |

(더 나아가면 structlog 같은 구조화된 로깅 라이브러리도 있다. 로그를 JSON 형태로 찍어서 로그 분석 도구(ELK, Datadog 등)에서 쉽게 파싱할 수 있게 만드는 건데, 이건 이 강의의 범위를 벗어나므로 관심 있으면 찾아보자.)

---

## 3. 오늘 키워드 정리

이번 챕터에서 새로 등장한 키워드들을 정리한다.

(Ch.1에서 "키워드를 모르면 검색도 못 하고 AI도 엉뚱한 답을 준다"고 했다. 이번 챕터에서 배운 System Call, I/O, Mode Switch 같은 키워드가 바로 그 예시다. "왜 느린지"를 설명하려면 이 키워드들이 있어야 한다.)

<details>
<summary>Bytecode (바이트코드)</summary>

소스 코드를 컴퓨터가 실행하기 직전 단계로 변환한 중간 코드다.
Python은 `.py` -> bytecode -> CPython VM 실행 순서로 동작한다.
`dis` 모듈로 Python bytecode를 확인할 수 있다.

</details>

<details>
<summary>stdout (표준 출력)</summary>

프로그램의 기본 출력 통로. File Descriptor 1번에 해당한다.
`print()`는 내부적으로 `sys.stdout.write()`를 호출한다.
터미널에 연결되어 있을 때는 라인 버퍼링으로 동작한다.

</details>

<details>
<summary>File Descriptor (파일 디스크립터, fd)</summary>

운영체제가 열린 파일이나 I/O 자원에 부여하는 정수 번호.
0: stdin, 1: stdout, 2: stderr.
네트워크 소켓도 fd를 부여받는다.
Unix의 "Everything is a file" 철학의 핵심 개념이다.

</details>

<details>
<summary>System Call (시스템 콜)</summary>

사용자 프로그램이 커널에게 하드웨어 관련 작업을 요청하는 인터페이스.
`write()`, `read()`, `open()`, `close()`, `fork()` 등이 있다.
일반적인 파일/소켓 I/O 작업은 System Call을 통해야 한다.

</details>

<details>
<summary>Kernel (커널)</summary>

운영체제의 핵심 프로그램. 하드웨어 자원을 관리하고 프로그램 간 중재 역할을 한다.
System Call을 통해서만 접근 가능하다.

</details>

<details>
<summary>User Mode / Kernel Mode (사용자 모드 / 커널 모드)</summary>

CPU의 두 가지 권한 수준.
User Mode에서는 하드웨어 직접 접근이 불가하고, Kernel Mode에서는 모든 자원에 접근 가능하다.
System Call 호출 시 User -> Kernel -> User 왕복이 발생하며, 이 전환에 수백~수천 CPU 사이클이 소요된다.

</details>

<details>
<summary>write() System Call</summary>

`write(fd, buffer, count)` - 지정된 fd에 데이터를 쓰는 System Call.
`print("a")`는 결국 `write(1, "a\n", 2)`로 변환된다.

</details>

<details>
<summary>CPU Cycle (CPU 사이클)</summary>

CPU의 기본 동작 단위. 3GHz CPU는 초당 30억 사이클이 돌아간다.
단순 연산은 1 사이클, 메모리 접근은 수백 사이클, System Call은 수백~수천 사이클이 필요하다.

</details>

<details>
<summary>Buffer (버퍼)</summary>

I/O 효율을 위해 데이터를 임시로 모아두는 메모리 공간.
Python stdout은 터미널 연결 시 라인 버퍼링(줄바꿈마다 flush), 파일 연결 시 풀 버퍼링으로 동작한다.

</details>

<details>
<summary>flush (플러시)</summary>

버퍼에 쌓아둔 데이터를 실제로 내보내고 버퍼를 비우는 행위.
flush가 일어나면 `write()` System Call이 호출된다.

</details>

<details>
<summary>I/O (Input/Output, 입출력)</summary>

프로그램이 외부와 데이터를 주고받는 행위의 총칭.
화면 출력, 파일 읽기/쓰기, 네트워크 통신, 키보드 입력 등이 전부 I/O다.
CPU 연산보다 압도적으로 느리며, 대부분의 성능 문제는 I/O에서 시작된다.

</details>

<details>
<summary>Mode Switch (모드 전환)</summary>

CPU가 User Mode에서 Kernel Mode로, 또는 그 반대로 전환되는 것.
System Call 호출 시마다 발생하며, 작업 상태 저장/복원 등의 오버헤드가 따른다.
이후 챕터에서 다룰 Context Switch(프로세스/스레드 간 전환)와는 구분되는 개념이다.

</details>

<details>
<summary>Throughput (처리량)</summary>

단위 시간당 처리할 수 있는 작업의 양. 보통 req/s로 표현하며, 높을수록 좋다.

</details>

<details>
<summary>Latency (지연 시간)</summary>

요청부터 응답까지 걸리는 시간. 보통 ms 단위로 표현하며, 낮을수록 좋다.

</details>

<details>
<summary>VU (Virtual User, 가상 사용자)</summary>

부하 테스트에서 실제 사용자를 시뮬레이션하는 가상 클라이언트.
k6에서 `vus: 100`이면 100명이 동시에 요청을 보내는 상황을 재현한다.

</details>


### 키워드 연관 관계

```mermaid
graph LR
    print["print()"] --> stdout
    stdout --> fd["File Descriptor"]
    stdout --> buffer["Buffer"]
    buffer -->|flush| write["write() System Call"]
    fd --> write
    write --> MS["Mode Switch"]
    MS --> kernel["Kernel"]
    MS --> UM["User Mode"]
    MS --> KM["Kernel Mode"]
    MS --> cycle["CPU Cycle"]
    write --> IO["I/O"]
    print -.-> bytecode["Bytecode"]

    ch1["Ch.1 Keyword (키워드)"] -.->|"이 챕터의 모든 키워드"| print
```


## 다음에 이어지는 이야기

이번 챕터에서는 `print()`라는 단순한 함수 하나가 System Call과 모드 전환이라는 무거운 작업을 유발한다는 걸 확인했다.

그런데 한 가지 의문이 남는다. "그러면 I/O를 async로 처리하면 해결되는 거 아닌가?"

다음 챕터에서는 CPU Bound와 I/O Bound의 차이를 다루면서, "모든 걸 async로 하면 빨라진다"는 흔한 오해를 깨부순다.

---

[< System Call이 왜 비싼가](./03-syscall-cost.md)

[< Ch.1 왜 CS를 공부해야 하는가](../ch01/README.md) | [Ch.3 로그를 뺐더니 빨라졌어요? (2) - CPU Bound와 I/O Bound >](../ch03/README.md)
