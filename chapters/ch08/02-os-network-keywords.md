# Ch.8 OS와 네트워크 키워드

[< 사례: 같은 문제, 다른 카테고리의 키워드](./01-case.md) | [DB와 자료구조 키워드 >](./03-db-ds-keywords.md)

---

앞에서 같은 "API가 느리다"라는 문제를 OS, DB, 네트워크 세 방향으로 진단하는 걸 봤다. 이번에는 OS와 네트워크 카테고리의 핵심 키워드를 정리한다. 각 키워드가 어떤 상황에서, 어떤 프롬프트에 쓰이는지를 표로 보여준다.


## OS 키워드

OS 키워드는 "프로그램이 컴퓨터 자원을 어떻게 쓰는가"를 다룬다. 성능, 동시성, 메모리 문제를 진단할 때 필요하다.

| 키워드 | 한 줄 설명 | 이런 상황에 쓴다 | 프롬프트 예시 |
|--------|-----------|-----------------|-------------|
| System Call | 프로그램이 커널에 작업을 요청하는 인터페이스 | 로그/파일 I/O가 많아서 느릴 때 | "write() System Call 횟수가 너무 많다. 버퍼링을 적용해줘" |
| Context Switch | 실행 중인 프로세스/스레드를 전환하는 비용 | 스레드를 너무 많이 만들어서 느릴 때 | "스레드 500개가 Context Switch 때문에 느리다. Thread Pool로 제한해줘" |
| Blocking I/O / Non-blocking I/O | I/O 완료를 기다리느냐 안 기다리느냐 | 외부 호출이 직렬로 연결돼서 느릴 때 | "Blocking I/O를 Non-blocking으로 바꿔줘. asyncio 사용" |
| CPU Bound / I/O Bound | 병목이 CPU인지 I/O인지 | 최적화 방향을 결정할 때 | "CPU Bound 작업이니까 ProcessPoolExecutor로 병렬화해줘" |
| Race Condition | 공유 자원 동시 접근으로 결과가 달라지는 현상 | 동시 요청에서 데이터가 꼬일 때 | "Race Condition이다. Critical Section에 Lock을 걸어줘" |
| Deadlock | 둘 이상의 스레드가 서로를 기다리며 멈추는 상태 | 서버가 간헐적으로 멈출 때 | "Deadlock이 의심된다. Lock Ordering을 적용해줘" |
| OOM (Out of Memory) | 가용 메모리가 전부 소진된 상태 | 서버가 죽거나 kill 당할 때 | "RSS가 계속 증가한다. tracemalloc으로 Heap 누수를 추적해줘" |
| Page Fault | 물리 메모리에 없는 데이터에 접근할 때 발생 | 대용량 데이터 처리가 갑자기 느려질 때 | "Thrashing이 의심된다. 데이터를 chunk 단위로 나눠서 처리해줘" |

(Ch.2~5에서 배운 키워드가 대부분이다. "이걸 프롬프트에 어떻게 쓰는가"가 이번 챕터에서 추가되는 관점이다.)


## 네트워크 키워드

네트워크 키워드는 "프로그램이 다른 시스템과 어떻게 통신하는가"를 다룬다. 서버 간 통신, 외부 API 호출, DB 연결 문제를 진단할 때 필요하다.

| 키워드 | 한 줄 설명 | 이런 상황에 쓴다 | 프롬프트 예시 |
|--------|-----------|-----------------|-------------|
| Latency | 요청에서 응답까지 걸리는 시간 | 응답이 느린 원인을 정량화할 때 | "p99 Latency가 500ms다. 어디서 시간이 걸리는지 tracing 넣어줘" |
| Throughput | 단위 시간당 처리 건수 | 서버의 처리 용량을 측정할 때 | "현재 Throughput이 100 req/s인데 500까지 올려야 한다" |
| Connection Pool | 미리 만들어둔 Connection을 재활용하는 구조 | DB/외부 서비스 연결 문제에 | "Connection Pool이 고갈된다. pool_size를 늘리고 pool_recycle을 설정해줘" |
| Keep-Alive | TCP Connection을 유지해서 재활용하는 기법 | HTTP 요청마다 새 Connection이 생기는 문제에 | "requests.Session으로 Keep-Alive 적용해줘" |
| TIME_WAIT | Connection 종료 후 대기 상태 | 포트 고갈 문제에 | "TIME_WAIT가 수천 개다. Connection Pool로 재활용해줘" |
| RTT (Round-Trip Time) | 패킷 왕복 시간 | 외부 API 호출이 느릴 때 | "RTT가 100ms인 외부 API를 3개 직렬 호출하고 있다. 병렬로 바꿔줘" |
| DNS Resolution | 도메인 이름을 IP로 변환하는 과정 | 첫 요청만 유독 느릴 때 | "DNS Resolution이 느린 것 같다. DNS 캐시를 확인해줘" |
| Load Balancing | 트래픽을 여러 서버에 분산하는 기법 | 특정 서버에 요청이 몰릴 때 | "Round Robin Load Balancing을 Least Connections로 바꿔줘" |

(Ch.6에서 배운 키워드가 대부분이다. DNS Resolution, Load Balancing은 이후 챕터에서 다룬다.)


## OS + 네트워크 키워드의 조합

실무에서는 하나의 카테고리 키워드만으로 해결되지 않는 경우가 많다. 두 카테고리를 조합해야 하는 사례를 보자.

### 사례: 외부 API 호출이 느리고, 동시에 메모리도 증가한다

```
[키워드 조합 프롬프트]
외부 API를 요청당 3번 호출하는데, 각각 Blocking I/O라서 직렬로 300ms 걸린다.
그리고 응답 데이터를 전부 메모리에 쌓고 있어서 RSS가 계속 증가한다.
1. Blocking I/O → asyncio.gather로 병렬 호출 (I/O Bound)
2. 응답 데이터는 처리 후 즉시 해제하도록 generator로 바꿔줘 (메모리)
```

Blocking I/O (OS) + RSS 증가 (OS/메모리) + asyncio (네트워크/비동기) 키워드를 조합했다. 이렇게 프롬프트를 주면 AI는 두 문제를 동시에 해결하는 코드를 생성한다. 키워드를 모르면 "API가 느리고 메모리도 많이 쓴다"라고만 할 수 있고, AI는 두 문제 중 하나만 건드릴 가능성이 높다.

---

[< 사례: 같은 문제, 다른 카테고리의 키워드](./01-case.md) | [DB와 자료구조 키워드 >](./03-db-ds-keywords.md)
