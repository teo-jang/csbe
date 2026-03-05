# CSBE 키워드 누적 목록

챕터별로 등장하는 CS 키워드를 누적 관리한다.
- 새 키워드: 해당 챕터에서 처음 등장
- 재등장 키워드: 이전 챕터에서 이미 다뤘고 다시 연결되는 개념

---

## Ch.1 - 왜 CS를 공부해야 하는가

| 키워드 | 분류 | 한 줄 설명 |
|--------|------|-----------|
| Computational Thinking | 새 키워드 | 문제를 CS 개념으로 분해하고 해결하는 사고방식 |
| Keyword (키워드) | 새 키워드 | CS 개념을 지칭하는 용어, 검색과 AI 활용의 출발점 |
| WORD size | 새 키워드 | CPU가 한 번에 처리하는 데이터의 기본 단위 크기 |
| JD (Job Description) | 새 키워드 | 채용 공고에 명시된 직무 요구사항 |

### 키워드 연관 관계

```mermaid
graph LR
    KW["Keyword<br/>(키워드)"]
    CT["Computational<br/>Thinking"]
    WS["WORD size"]
    JD["JD"]

    KW -->|"키워드를 알아야<br/>분해할 수 있다"| CT
    KW -->|"키워드를 모르면<br/>검색도 못 한다"| JD
    KW -->|"키워드를 모르면<br/>생기는 일의 예시"| WS
```

---

## Ch.2 - 로그를 뺐더니 빨라졌어요? (1) - System Call과 커널

| 키워드 | 분류 | 한 줄 설명 |
|--------|------|-----------|
| Bytecode | 새 키워드 | 소스 코드를 실행 직전 단계로 변환한 중간 코드 |
| stdout | 새 키워드 | 프로그램의 기본 출력 통로, fd 1번 |
| File Descriptor (fd) | 새 키워드 | 운영체제가 열린 파일/자원에 부여하는 정수 번호 |
| System Call | 새 키워드 | 사용자 프로그램이 커널에게 작업을 요청하는 인터페이스 |
| Kernel | 새 키워드 | 운영체제의 핵심 프로그램, 하드웨어 자원 관리자 |
| User Mode / Kernel Mode | 새 키워드 | CPU의 두 가지 권한 수준 |
| write() | 새 키워드 | 파일/자원에 데이터를 쓰는 System Call |
| CPU Cycle | 새 키워드 | CPU의 기본 동작 단위, 성능 측정의 기준 |
| Buffer | 새 키워드 | I/O 효율을 위해 데이터를 임시로 모아두는 메모리 공간 |
| flush | 새 키워드 | 버퍼의 데이터를 실제로 내보내고 비우는 행위 |
| I/O | 새 키워드 | 프로그램이 외부와 데이터를 주고받는 행위 |
| Mode Switch | 새 키워드 | User Mode <-> Kernel Mode 전환 |
| Throughput | 새 키워드 | 단위 시간당 처리량, req/s |
| Latency | 새 키워드 | 요청~응답 소요 시간, ms |
| VU | 새 키워드 | 부하 테스트의 가상 사용자 |

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
```

---

## Ch.3 - 로그를 뺐더니 빨라졌어요? (2) - CPU Bound와 I/O Bound

| 키워드 | 분류 | 한 줄 설명 |
|--------|------|-----------|
| CPU Bound | 새 키워드 | 실행 속도가 CPU 연산 능력에 의해 제한되는 상태 |
| I/O Bound | 새 키워드 | 실행 속도가 I/O 속도에 의해 제한되는 상태 |
| Blocking I/O | 새 키워드 | I/O 완료까지 호출 측이 멈추고 기다리는 방식 |
| Non-blocking I/O | 새 키워드 | I/O 요청 후 바로 돌아오는 방식 |
| Context Switch | 새 키워드 | 실행 중인 프로세스/스레드를 다른 것으로 전환 |
| GIL | 새 키워드 | CPython에서 한 번에 하나의 스레드만 바이트코드 실행 가능하게 하는 잠금 |
| Event Loop | 새 키워드 | asyncio의 핵심 엔진, 단일 스레드에서 비동기 작업 스케줄링 |
| Coroutine | 새 키워드 | 실행을 중간에 멈췄다가 이어서 실행할 수 있는 함수 |
| async/await | 새 키워드 | Python 비동기 프로그래밍 문법 |
| Thread Pool | 새 키워드 | 미리 생성된 스레드 묶음에 작업을 분배하는 구조 |
| Process Pool | 새 키워드 | 미리 생성된 프로세스 묶음에 작업을 분배하는 구조 |
| Concurrency | 새 키워드 | 여러 작업이 논리적으로 동시에 진행되는 것 |
| Parallelism | 새 키워드 | 여러 작업이 물리적으로 같은 순간에 실행되는 것 |
| IPC | 새 키워드 | 프로세스 간 데이터 교환 (Inter-Process Communication) |
| I/O | 재등장 (Ch.2) | I/O Bound의 "I/O" |
| Mode Switch | 재등장 (Ch.2) | Context Switch와 비교 대상 |
| Throughput | 재등장 (Ch.2) | 벤치마크에서 req/s 비교에 사용 |
| Latency | 재등장 (Ch.2) | 벤치마크에서 응답 시간 비교에 사용 |

### 키워드 연관 관계

```mermaid
graph LR
    CB["CPU Bound"] --> GIL
    IB["I/O Bound"] --> BIO["Blocking I/O"]
    IB --> NBIO["Non-blocking I/O"]

    GIL -->|"CPU Bound에서<br/>스레드 무의미"| TP["Thread Pool"]
    GIL -->|"우회"| PP["Process Pool"]

    NBIO --> EL["Event Loop"]
    EL --> CR["Coroutine"]
    CR --> AA["async/await"]

    CB -->|"추천"| PP
    IB -->|"추천"| AA
    IB -->|"추천"| TP

    PP --> PAR["Parallelism"]
    TP --> CON["Concurrency"]
    EL --> CON

    CS["Context Switch"] --> TP
    CS --> PP

    ch2_io["Ch.2 I/O"] -.->|"I/O Bound의 I/O"| IB
    ch2_ms["Ch.2 Mode Switch"] -.->|"vs"| CS
```

---

## Ch.4 - 프로세스와 스레드, 진짜로 이해하고 있는가

| 키워드 | 분류 | 한 줄 설명 |
|--------|------|-----------|
| Process | 새 키워드 | 실행 중인 프로그램의 인스턴스, 독립적인 메모리 공간을 가진다 |
| Thread | 새 키워드 | 프로세스 안의 경량 실행 단위, Stack만 별도이고 나머지 메모리를 공유 |
| PCB (Process Control Block) | 새 키워드 | 운영체제가 프로세스를 관리하기 위한 자료구조 |
| TCB (Thread Control Block) | 새 키워드 | 운영체제가 스레드를 관리하기 위한 자료구조 |
| Memory Layout | 새 키워드 | 프로세스의 가상 주소 공간 구성 (Text, Data, Heap, Stack) |
| Text Segment | 새 키워드 | 실행 코드(기계어)가 저장되는 Read-only 영역 |
| Data Segment | 새 키워드 | 전역/static 변수가 저장되는 영역 |
| Heap | 새 키워드 | 동적 할당 메모리 영역, 아래에서 위로 자란다 |
| Stack | 새 키워드 | 함수 호출 정보(Stack Frame)가 저장되는 고정 크기 영역 |
| Stack Frame | 새 키워드 | 함수 호출 시 Stack에 쌓이는 데이터 묶음 (매개변수, 지역변수, 복귀주소) |
| Virtual Memory | 새 키워드 | OS가 프로세스에게 제공하는 가상의 메모리 주소 공간 |
| Physical Memory | 새 키워드 | 실제 RAM, 크기가 물리적으로 고정 |
| Page / Page Table | 새 키워드 | 가상 메모리를 4KB 블록으로 관리, Page Table이 가상→물리 주소 변환 |
| Page Fault | 새 키워드 | 물리 메모리에 없는 Page 접근 시 발생하는 인터럽트 |
| OOM (Out of Memory) | 새 키워드 | 사용 가능한 메모리가 모두 소진된 상태 |
| RSS (Resident Set Size) | 새 키워드 | 프로세스가 실제로 물리 메모리에 올려놓은 데이터 크기 |
| Thrashing | 새 키워드 | Page In/Out이 끊임없이 반복되어 시스템이 극도로 느려지는 상태 |
| Context Switch | 재등장 (Ch.3) | PCB/TCB를 저장하고 복원하는 과정이라는 구체적 의미 |
| Mode Switch | 재등장 (Ch.2) | Page Fault 시 User→Kernel 전환이 발생 |
| Kernel | 재등장 (Ch.2) | Virtual Memory를 관리하는 주체, Page Fault 처리 |
| GIL | 재등장 (Ch.3) | 스레드의 Heap 공유와 연결, Reference Counting 보호 |
| Thread Pool / Process Pool | 재등장 (Ch.3) | 메모리 관점에서의 비용 차이를 이해 |
| IPC | 재등장 (Ch.3) | 프로세스가 메모리를 분리하기 때문에 IPC가 필요 |

### 키워드 연관 관계

```mermaid
graph LR
    PROC["Process"] --> PCB
    THREAD["Thread"] --> TCB
    PROC --> ML["Memory Layout"]
    ML --> STACK["Stack"]
    ML --> HEAP["Heap"]
    ML --> DATA["Data Segment"]
    ML --> TEXT["Text Segment"]
    STACK --> SF["Stack Frame"]
    STACK -->|"넘치면"| SO["Stack Overflow"]
    HEAP -->|"끝없이 자라면"| OOM

    PROC --> VM["Virtual Memory"]
    VM --> PT["Page Table"]
    VM --> PM["Physical Memory"]
    PT --> PF["Page Fault"]
    PF -.->|"Ch.2"| MS["Mode Switch"]
    PM -->|"꽉 차면"| OOM
    VM --> RSS

    PROC -->|"전환 시"| CS["Context Switch<br/>(Ch.3)"]
    CS --> PCB
    THREAD -->|"Stack만 별도<br/>나머지 공유"| ML
    THREAD -.->|"Ch.3"| GIL

    ch3_tp["Ch.3 Thread Pool"] -.->|"메모리 공유"| THREAD
    ch3_pp["Ch.3 Process Pool"] -.->|"메모리 분리"| PROC

    style OOM fill:#f96,stroke:#333
    style SO fill:#f96,stroke:#333
```
