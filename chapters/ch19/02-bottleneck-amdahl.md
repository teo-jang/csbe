# Ch.19 Bottleneck과 Amdahl의 법칙

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)

---

앞에서 DB가 Bottleneck인 상태에서 서버를 늘려도 Latency가 개선되지 않는다는 걸 확인했다. Amdahl's Law로 이론적 한계를 계산했다. 이번에는 "그러면 Bottleneck을 어떻게 찾는가"와 "찾은 다음에 어떻게 해결하는가"를 이야기한다.


## Bottleneck 찾기: 어디가 느린가?

서버가 느릴 때 가능한 Bottleneck은 크게 다섯 가지다.

```
Bottleneck 후보
├── 1. CPU         → 연산이 많다
├── 2. Memory      → 메모리가 부족하다
├── 3. Disk I/O    → 디스크 읽기/쓰기가 느리다
├── 4. Network     → 네트워크 대역폭이 부족하다
└── 5. DB          → 쿼리가 느리다
```

하나씩 확인하는 방법을 보자.

### 1. CPU: top / htop

```bash
top
```

```
%Cpu(s): 95.2 us,  3.1 sy,  0.0 ni,  1.7 id,  0.0 wa,  0.0 hi,  0.0 si
```

봐야 할 항목:

| 항목 | 의미 | 위험 신호 |
|------|------|----------|
| us (user) | 애플리케이션이 사용하는 CPU | 90% 이상이면 CPU Bound |
| sy (system) | 커널이 사용하는 CPU | 20% 이상이면 System Call 과다 (Ch.2) |
| wa (iowait) | I/O 대기 | 10% 이상이면 Disk I/O Bottleneck |
| id (idle) | 놀고 있는 CPU | 낮으면 CPU가 바쁜 거다 |

`us`가 95%면 CPU Bound다. 이 경우 서버를 늘리는 게 효과가 있다. CPU 연산을 여러 서버가 나눠서 하니까. 하지만 `wa`가 높으면 Disk I/O가 문제다. 서버를 늘려도 디스크가 느린 건 변하지 않는다.

(Ch.3에서 CPU Bound와 I/O Bound를 구분했다. top의 `us`와 `wa`가 그 구분을 숫자로 보여준다.)

htop을 쓰면 CPU 코어별 사용률을 막대그래프로 볼 수 있다. 코어 8개 중 1개만 100%이고 나머지가 놀고 있다면? 단일 스레드 Bottleneck이다. Python의 GIL(Ch.3) 때문에 CPU Bound 작업이 하나의 코어만 사용하고 있을 가능성이 높다. 이 경우에는 서버를 늘리기보다 Process Pool(Ch.3)이나 multiprocessing으로 해결하는 게 먼저다.

### 2. Memory: free -h

```bash
free -h
```

```
              total        used        free      shared  buff/cache   available
Mem:           15Gi       12Gi       512Mi       256Mi        2.5Gi        2.8Gi
Swap:          2.0Gi       1.5Gi       512Mi
```

봐야 할 항목:

| 항목 | 위험 신호 |
|------|----------|
| available | total의 10% 이하면 메모리 부족 |
| Swap used | 0이 아니면 이미 메모리가 부족한 거다 |

Swap이 사용되고 있다는 건 Physical Memory가 부족해서 디스크를 메모리처럼 쓰고 있다는 뜻이다. Ch.4에서 다뤘던 Page Fault와 Thrashing이 발생하고 있을 수 있다. 디스크는 메모리보다 수만 배 느리니까 시스템 전체가 느려진다.

이 경우에는:
- 메모리 누수(Memory Leak)가 있는지 확인한다
- Process Pool(Ch.3)을 쓰고 있다면 프로세스 수를 줄인다 (각 프로세스가 별도 메모리를 쓴다, Ch.4)
- 서버 스펙을 올린다 (Scale-Up)

### 3. Disk I/O: iostat

```bash
iostat -x 1
```

```
Device     r/s     w/s   rkB/s   wkB/s  await  %util
sda        850     120   34000    4800    15.2   98.5
```

봐야 할 항목:

| 항목 | 의미 | 위험 신호 |
|------|------|----------|
| %util | 디스크 사용률 | 90% 이상이면 Disk I/O Bottleneck |
| await | I/O 요청 대기 시간 (ms) | 10ms 이상이면 느리다 |
| r/s, w/s | 초당 읽기/쓰기 횟수 | 절대값보다 추이를 본다 |

`%util`이 98%면 디스크가 꽉 차서 돌아가고 있다는 뜻이다. DB 서버에서 이 수치가 높으면 인덱스가 없어서 Full Table Scan(Ch.11)을 하고 있거나, 데이터가 메모리에 안 올라와서 디스크에서 읽고 있는 거다. SSD로 교체하거나(Scale-Up), 쿼리를 최적화해서 I/O 자체를 줄여야 한다.

### 4. Network: 대역폭

```bash
# 네트워크 인터페이스별 트래픽 확인
sar -n DEV 1
```

대역폭 Bottleneck은 의외로 많이 발생한다. API 응답에 불필요한 데이터를 포함하면(SELECT * 같은, Ch.16에서 다뤘다) 네트워크 트래픽이 급증한다. 이미지나 파일을 API 서버를 거쳐 전달하면 대역폭을 금방 소진한다. CDN(Ch.18)을 안 쓰면 정적 파일까지 API 서버가 처리하니까.

### 5. DB: SHOW PROCESSLIST

```sql
SHOW FULL PROCESSLIST;
```

Ch.16에서 자세히 다뤘다. `Time` 컬럼이 수십 초인 쿼리가 보이면 그게 Bottleneck이다. DB가 Bottleneck인 경우가 가장 흔하고, 해결 효과도 가장 크다.

### Bottleneck 진단 순서

실무에서 서버가 느릴 때 확인하는 순서다.

```
1. top → CPU가 바쁜가? I/O 대기가 높은가?
   ├── CPU 높음 → 코드 최적화, Process Pool, Scale-Out
   └── I/O 대기 높음 → 2번으로

2. iostat → 디스크가 바쁜가?
   ├── 디스크 사용률 높음 → 쿼리 최적화, SSD 교체, 캐시 추가
   └── 디스크 여유 있음 → 3번으로

3. free -h → 메모리가 부족한가?
   ├── Swap 사용 중 → 메모리 누수 확인, 스펙 업
   └── 메모리 여유 있음 → 4번으로

4. SHOW PROCESSLIST → DB 쿼리가 느린가?
   ├── Slow Query 발견 → 인덱스, 쿼리 최적화 (Ch.14~16)
   └── 쿼리 정상 → 5번으로

5. 네트워크 → 대역폭이 부족한가?
   ├── 트래픽 과다 → 응답 크기 줄이기, CDN, 압축
   └── 전부 정상 → 코드 레벨 프로파일링 (cProfile 등)
```

순서가 중요하다. 가장 흔하고 확인이 쉬운 것부터 보는 거다. top 하나면 CPU인지 I/O인지 일단 구분이 된다.


## Amdahl's Law 심화

앞에서 Amdahl's Law의 기본 수식을 봤다. 실무에 적용할 때 알아야 할 것이 몇 가지 더 있다.

### 실무 예시: API 처리 시간 분석

API가 느릴 때 가장 먼저 해야 하는 건, 각 단계별 소요 시간을 측정하는 거다.

```python
import time
import logging

logger = logging.getLogger(__name__)

@router.get("/search")
def search_products(query: str):
    t0 = time.perf_counter()

    # 1. 입력 검증
    validated = validate_input(query)
    t1 = time.perf_counter()

    # 2. DB 쿼리
    results = db.execute(search_query, validated)
    t2 = time.perf_counter()

    # 3. 결과 가공
    formatted = format_results(results)
    t3 = time.perf_counter()

    # 4. 캐시 저장
    cache.set(query, formatted, ttl=300)
    t4 = time.perf_counter()

    logger.info(
        f"검증: {t1-t0:.3f}s, "
        f"DB: {t2-t1:.3f}s, "
        f"가공: {t3-t2:.3f}s, "
        f"캐시: {t4-t3:.3f}s, "
        f"전체: {t4-t0:.3f}s"
    )
    return formatted
```

이 로그가 쌓이면 각 단계의 비율을 알 수 있다.

```
검증: 0.001s, DB: 1.200s, 가공: 0.150s, 캐시: 0.005s, 전체: 1.356s
```

DB가 전체의 88%다. 이 상태에서 Amdahl's Law를 적용하면:

```
P = 0.12 (병렬화 가능: 검증 + 가공 + 캐시)
1-P = 0.88 (병렬화 불가: DB 쿼리)

서버 무한대: Speedup = 1 / 0.88 = 1.14배
```

서버를 아무리 늘려도 1.14배까지만. 1.356초가 1.19초가 되는 게 한계다.

그런데 DB 쿼리를 0.1초로 줄이면?

```
검증: 0.001s, DB: 0.100s, 가공: 0.150s, 캐시: 0.005s, 전체: 0.256s
```

전체 응답 시간이 1.356초에서 0.256초로, 5.3배 빨라진다. 서버를 늘리는 것보다 DB 쿼리를 최적화하는 게 5배 이상 효과가 크다.

이게 "Bottleneck을 먼저 찾아라"의 정량적 근거다.


## Scale-Up vs Scale-Out

Bottleneck을 찾았다. 해결 방법은 크게 두 가지다.

<details>
<summary>Scale-Up (수직 확장)</summary>

서버 한 대의 성능을 높이는 방법이다. CPU를 더 빠른 걸로, RAM을 더 많이, 디스크를 SSD로 교체하는 식이다. 구현이 단순하다. 코드를 바꿀 필요가 없고, 아키텍처도 바뀌지 않는다. 단점은 물리적 한계가 있다는 것이다. 가장 빠른 CPU, 가장 많은 RAM에도 상한이 있다. 비용도 비선형적으로 증가한다. CPU 성능을 2배로 올리는 데 드는 비용은 2배가 아니라 3~4배일 수 있다.

(AWS에서 t3.micro를 t3.xlarge로 올리면 CPU 4배, 메모리 8배가 되지만 비용은 약 8배다. 더 위로 갈수록 비용 대비 성능 증가율이 낮아진다.)

</details>

<details>
<summary>Scale-Out (수평 확장)</summary>

서버 수를 늘려서 전체 처리 능력을 높이는 방법이다. 서버 1대에서 4대로, 4대에서 16대로. 이론적으로 무한히 확장 가능하다. 단점은 아키텍처가 복잡해진다는 것이다. Load Balancer가 필요하고, 세션 관리가 바뀌어야 하고, 배포 파이프라인이 복잡해진다. Amdahl's Law에 의해 순차 실행 부분이 있으면 효과가 제한된다.

</details>

| 항목 | Scale-Up | Scale-Out |
|------|----------|-----------|
| 방법 | 서버 스펙 향상 | 서버 수 증가 |
| 코드 변경 | 없음 | 필요할 수 있음 |
| 아키텍처 변경 | 없음 | Load Balancer, 세션 관리 등 |
| 확장 한계 | 물리적 상한 있음 | 이론적으로 무한 (Amdahl 제약 있음) |
| 비용 효율 | 높은 스펙일수록 비효율 | 저렴한 서버 여러 대 |
| 장애 대응 | 서버 1대 죽으면 전체 장애 | 1대 죽어도 나머지가 처리 |

### 언제 뭘 쓰는가

```
Bottleneck이 CPU (연산)         → Scale-Out이 효과적
Bottleneck이 Memory (부족)      → Scale-Up (RAM 증설)
Bottleneck이 Disk I/O           → Scale-Up (SSD) 또는 캐시
Bottleneck이 DB 쿼리            → 쿼리 최적화 → Read Replica → Scale-Up
Bottleneck이 Network            → CDN, 응답 크기 축소
```

DB가 Bottleneck일 때 서버를 늘리는 건(Scale-Out) 효과가 없다. DB를 최적화하거나(Ch.14~16), 캐시를 붙이거나(Ch.17~18), Read Replica(Ch.16)로 읽기를 분산하거나, DB 서버의 스펙을 올려야(Scale-Up) 한다.


## Scale-Out의 숨겨진 비용

"서버를 늘리면 되지"는 간단해 보이지만 숨겨진 비용이 있다.

### 1. Load Balancer

요청을 여러 서버에 분산하는 Load Balancer가 필요하다. Nginx, HAProxy, AWS ALB 같은 도구를 설정해야 한다. Load Balancer 자체가 SPOF(Single Point of Failure)가 될 수 있어서, Load Balancer도 이중화해야 한다.

<details>
<summary>Load Balancer (로드 밸런서)</summary>

들어오는 네트워크 트래픽을 여러 서버에 분산하는 장치(또는 소프트웨어)다. Round Robin(순서대로), Least Connection(가장 연결이 적은 서버에), IP Hash(같은 IP는 같은 서버에) 등의 분산 알고리즘이 있다. AWS에서는 ALB(Application Load Balancer)가 L7(HTTP) 레벨에서, NLB(Network Load Balancer)가 L4(TCP) 레벨에서 동작한다. Ch.8에서 키워드로 다뤘던 Load Balancing의 구현체다.

</details>

### 2. Session 관리

서버가 1대일 때는 사용자 세션을 서버 메모리에 저장해도 된다. 서버가 4대가 되면? 사용자 A가 서버 1에 로그인했는데 다음 요청이 서버 3으로 가면 세션이 없다.

해결 방법:
- Sticky Session: 같은 사용자는 항상 같은 서버로 보낸다. 서버가 죽으면 세션이 날아간다.
- Session 외부 저장: Redis에 세션을 저장한다 (Ch.17). 어떤 서버가 받아도 Redis에서 세션을 읽을 수 있다.
- Stateless: JWT 같은 토큰 기반 인증으로 서버에 세션을 저장하지 않는다. Ch.23에서 다룬다.

### 3. 배포 복잡도

서버 1대면 코드를 올리고 재시작하면 끝이다. 서버 4대면? 4대를 동시에 배포해야 한다. Rolling Deployment(한 대씩 순서대로), Blue-Green Deployment(새 환경을 미리 만들고 한 번에 전환) 같은 전략이 필요하다. CI/CD 파이프라인이 복잡해진다.

### 4. 모니터링

서버 1대의 로그를 보는 건 쉽다. 서버 4대의 로그를 통합해서 보려면 중앙 집중식 로그 시스템(ELK Stack, Datadog 등)이 필요하다. "어느 서버에서 에러가 났는가"를 파악하는 것도 복잡해진다.

### 5. 비용

서버 4대면 비용이 4배가 아니다. Load Balancer, 모니터링 도구, 중앙 로그 시스템, 추가 네트워크 트래픽까지 합치면 5~6배 이상이 될 수 있다.

이런 이유로 "서버를 늘리기 전에 최적화를 먼저 하라"는 말이 나오는 거다. DB 쿼리에 인덱스 하나 거는 건 공짜다. 캐시를 추가하는 건 Redis 서버 1대 비용이다. 서버를 4대로 늘리고 그에 따른 인프라를 구축하는 건 훨씬 비싸다.


## Bottleneck 해결 순서

Part 4~5에서 다룬 내용을 종합하면, 성능 문제를 해결하는 순서는 이렇다.

```
1단계: 측정
  └── "어디가 느린가?" - top, iostat, SHOW PROCESSLIST, 로그

2단계: 쿼리 최적화 (Ch.14~16)
  └── 인덱스, EXPLAIN, Cursor-based Pagination, 쿼리 재작성

3단계: 캐시 (Ch.17~18)
  └── 자주 읽고 잘 안 바뀌는 데이터 → Cache-Aside + TTL
  └── 계층 캐시: Local → Remote → DB

4단계: Read Replica (Ch.16)
  └── 읽기 부하 분산, 배치 작업 분리

5단계: Scale-Out
  └── 서버 수 증가 + Load Balancer + Session 외부화

6단계: Sharding (Ch.16)
  └── 마지막 수단, 운영 비용 매우 높음
```

순서가 위에서 아래로 갈수록 비용이 늘고 복잡도가 올라간다. 1~3단계를 안 하고 5단계로 뛰어가는 건, Ch.14의 제목대로 "인덱스를 안 걸어놓고 Redis를 설치한" 것과 같은 실수다.


## Universal Scalability Law (간략 언급)

Amdahl's Law는 "순차 실행 부분"만 고려한다. 현실에서는 서버를 늘릴수록 발생하는 또 다른 비용이 있다. 서버끼리 데이터를 동기화하는 비용이다. 이걸 coherence penalty라고 한다.

Neil Gunther가 제시한 Universal Scalability Law(USL)는 Amdahl's Law에 이 coherence penalty를 추가한 모델이다.

(출처: Gunther, Neil J. "Guerrilla Capacity Planning: A Tactical Approach to Planning for Highly Scalable Applications." Springer, 2007)

```
Amdahl:  순차 실행 부분 때문에 성능 향상에 상한이 있다
USL:     거기에 더해서, 서버끼리 동기화하는 비용 때문에
         어느 시점부터는 서버를 늘리면 오히려 느려진다
```

```
성능
  |
  |        ........
  |      .         .          ← USL (서버를 늘리면 오히려 느려지는 구간)
  |     .           .
  |    .
  |   .         ------------ ← Amdahl (수평선에 수렴)
  |  .       ---
  | .     --
  |.   --
  +--+---+---+---+---+---→ 서버 수
```

Cache Invalidation(Ch.18), 분산 Lock, Session 동기화 같은 것이 coherence penalty에 해당한다. 서버가 늘수록 이런 동기화 비용이 커져서, 어느 시점부터는 서버를 추가하면 오히려 전체 성능이 떨어진다.

이 강의에서 USL 수식까지 다루지는 않는다. 핵심만 기억하면 된다: 서버를 무한히 늘리면 Amdahl's Law의 상한에 도달하는 게 아니라, 그 전에 동기화 비용 때문에 성능이 떨어질 수 있다. "서버를 늘리면 해결된다"는 생각이 왜 위험한지의 또 다른 근거다.

---

[< 사례](./01-case.md) | [유사 사례와 키워드 정리 >](./03-summary.md)
