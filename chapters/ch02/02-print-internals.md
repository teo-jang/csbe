# Ch.2 CS Drill Down (1) - print()는 어디로 가는가

[< 사례와 코드](./01-case.md) | [CS Drill Down (2) >](./03-syscall-cost.md)

---

대부분의 개발자가 `print()`를 "화면에 출력하는 간단한 함수" 정도로 생각한다. 틀렸다. `print()`는 네 프로그램을 운영체제 커널의 영역까지 끌고 가는 무거운 작업이다. 어디로 가는지 추적해보자.


## print()의 정체 - bytecode로 들여다보기

먼저 `dis` 모듈로 Python이 `print()`를 어떻게 처리하는지 본다.

```python
import dis

def with_print():
    print("a")

def without_print():
    x = "a"

dis.dis(with_print)
dis.dis(without_print)
```

실행하면 (Python 버전에 따라 세부 형태가 다를 수 있지만 핵심은 같다):

```
=== with_print ===
  LOAD_GLOBAL    print       # print 함수를 찾아온다
  LOAD_CONST     'a'         # 문자열 'a'를 준비한다
  CALL           1           # print 함수를 호출한다

=== without_print ===
  LOAD_CONST     'a'         # 문자열 'a'를 준비한다
  STORE_FAST     x           # 변수 x에 저장한다
```

핵심: `print`는 Python 키워드가 아니라 함수다. CALL로 호출된다. 함수 호출이라는 건, 그 안에서 뭔가가 더 일어난다는 뜻이다.


## print() -> stdout -> File Descriptor

그럼 `print()` 안에서는 뭐가 일어나는가? `print("a")`를 호출하면 내부적으로 문자열 `"a"`와 줄바꿈 `"\n"`을 stdout에 쓴다. Python의 TextIOWrapper가 이 둘을 합쳐서 `"a\n"`이라는 2바이트 데이터를 만들고, 이걸 fd 1번(stdout)에 쓰기를 요청한다.

<details>
<summary>stdout (표준 출력, Standard Output)</summary>

프로그램이 텍스트를 내보내는 기본 출력 통로다.
터미널에서 프로그램을 실행했을 때 화면에 글자가 나오는 건, 그 글자가 stdout을 통해 터미널로 전달되기 때문이다.
Unix/Linux 시스템에서는 stdout이 "파일"처럼 취급된다. 이게 핵심이다.
모든 프로그램은 시작할 때 자동으로 3개의 표준 스트림을 받는다:
- stdin (표준 입력, fd 0): 키보드 입력
- stdout (표준 출력, fd 1): 화면 출력
- stderr (표준 에러, fd 2): 에러 출력

</details>

"stdout은 파일처럼 취급된다"는 말이 중요하다. Unix/Linux에서는 화면 출력도, 파일 쓰기도, 네트워크 전송도 전부 "파일에 쓰기"로 추상화된다. 이 추상화의 핵심이 File Descriptor다.

<details>
<summary>File Descriptor (파일 디스크립터, fd)</summary>

운영체제가 열려있는 파일(또는 파일처럼 취급되는 대상)을 식별하기 위해 부여하는 정수 번호다.
프로그램이 파일을 열면 운영체제가 번호를 하나 준다. 이후 그 번호로 "이 파일에 써줘", "이 파일에서 읽어줘"라고 요청한다.
모든 프로세스는 기본적으로 3개의 fd를 가지고 시작한다:
- 0: stdin
- 1: stdout
- 2: stderr

네트워크 소켓도 fd를 부여받는다. "Everything is a file"이라는 Unix 철학의 핵심이 여기 있다.

</details>

정리하면: `print("a")` -> `sys.stdout.write("a\n")` -> fd 1번에 쓰기.


## fd에 "쓴다"는 건 무슨 뜻인가

그런데 fd 1번에 "쓴다"는 건 구체적으로 뭘 의미하는가? 내 프로그램이 직접 하드웨어(터미널)에 접근해서 글자를 찍는 걸까?

아니다. 절대 아니다. 일반 프로그램은 하드웨어에 직접 접근할 수 없다. 위험하니까. 만약 모든 프로그램이 디스크에 마음대로 쓸 수 있다면, 버그 하나로 다른 프로그램의 데이터를 날려버릴 수 있다. 그래서 운영체제는 "사용자 프로그램이 할 수 있는 영역"과 "커널만 할 수 있는 영역"을 칼로 자르듯 나눠놨다.

하드웨어에 뭔가를 쓰려면, 반드시 커널에게 "이거 좀 대신 해줘"라고 부탁해야 한다. 이 부탁하는 행위가 System Call이다.

<details>
<summary>System Call (시스템 콜)</summary>

사용자 프로그램이 운영체제 커널에게 "이 일 좀 해줘"라고 요청하는 공식적인 방법이다.
파일 읽기/쓰기, 네트워크 통신, 메모리 할당, 프로세스 생성 등 하드웨어와 관련된 작업은 전부 System Call을 통해야 한다.
대표적인 System Call: `write()`, `read()`, `open()`, `close()`, `fork()`, `exec()`

</details>

<details>
<summary>Kernel (커널)</summary>

운영체제의 핵심 프로그램이다. 하드웨어와 소프트웨어 사이의 중재자 역할을 한다.
CPU, 메모리, 디스크, 네트워크 장치 등 모든 하드웨어 자원을 관리하고, 프로그램들이 이 자원을 안전하게 사용할 수 있도록 중재한다.
Linux 커널, Windows NT 커널, macOS의 XNU 커널 등이 있다.

</details>


## 여기까지의 흐름

```
print("a")
  -> sys.stdout.write("a\n")
    -> fd 1번에 쓰기
      -> write() System Call 호출
        -> 커널에게 "터미널에 이거 찍어줘" 부탁
```

print 한 줄이 커널까지 간다. 이게 첫 번째 핵심이다.

그런데 커널에게 부탁하는 과정이 왜 비싼 걸까? 다음 페이지에서 그 비용을 구체적으로 파고든다.

---

[< 사례와 코드](./01-case.md) | [CS Drill Down (2) - System Call이 왜 비싼가 >](./03-syscall-cost.md)
