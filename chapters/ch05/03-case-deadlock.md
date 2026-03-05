# Ch.5 사례 B: Lock을 걸었더니 서버가 먹통이다

[< Critical Section과 Lock](./02-critical-section.md) | [왜 이렇게 되는가 - Deadlock의 조건과 Semaphore >](./04-deadlock-conditions.md)

---

앞에서 Lock으로 Race Condition을 해결했다. 재고가 더 이상 마이너스가 되지 않는다. 그런데 Lock을 잘못 쓰면 어떻게 되는가? 서버가 에러도 안 내고 먹통이 된다.


## 5-1. 사례 설명

사례 A에서 재고 보호 문제를 Lock으로 해결한 개발자가 기능을 확장한다. 이번에는 창고 간 재고 이동이다.

창고가 두 개 있다. 창고 A와 창고 B. "창고 A에서 10개를 빼서 창고 B에 넣는" API가 필요하다.

재고 이동은 두 창고를 동시에 건드려야 한다. A에서 빼고 B에 넣는 건 하나의 묶음이다. 중간에 다른 요청이 끼어들면 데이터가 꼬인다. 그래서 두 창고의 Lock을 모두 잡고 이동을 처리한다.

개발 환경에서 A→B 이동 테스트. 잘 된다. B→A 이동 테스트. 잘 된다.

부하 테스트: A→B와 B→A를 동시에 요청했다.

서버가 응답을 안 한다. 에러 로그도 없다. CPU도 안 쓴다. 프로세스는 살아 있다. 그냥 멈춰 있다.

"서버가 살아 있는데 응답을 안 한다. 에러도 없다. 뭐가 문제인 거지?"


## 5-2. 결과 예측

- "A→B 15건, B→A 15건을 동시에 보내면 어떻게 되는가?"
- "에러가 나는가? 느려지는가? 아예 안 되는가?"
- "Lock 순서를 고정하면 해결되는가?"

<!-- 기대 키워드: Deadlock, Lock Ordering, Circular Wait, Hold and Wait -->


## 5-3. 결과 분석

k6로 10 VUs(짝수 VU는 A→B, 홀수 VU는 B→A)가 각 3번씩 이동 요청을 보냈다. 총 30건.

| 시나리오 | 총 요청 | 성공 | Deadlock Timeout | 비고 |
|----------|---------|------|-----------------|------|
| unsafe (Lock 순서 미고정) | 30 | 3 | 27 | 90%가 Deadlock |
| safe (Lock 순서 고정) | 30 | 30 | 0 | 정상 |

측정 환경: M1 Mac, Python 3.12, FastAPI 0.111, uvicorn, k6 10 VUs

unsafe에서 30건 중 27건이 5초 Timeout에 걸렸다. 평균 응답 시간 4.71초. 대부분의 요청이 Lock을 기다리다가 포기한 거다.

(실제 운영 환경이라면 timeout 없이 무한 대기했을 거다. 이 실습에서는 서버가 완전히 멈추는 걸 방지하기 위해 `lock.acquire(timeout=5)`로 5초 제한을 뒀다.)

safe에서는 30건 전부 정상 처리. Deadlock 0건. Lock 순서를 고정한 것뿐인데.


## 5-4. 코드 설명

먼저 창고 상태를 선언한다. 각 창고가 자기만의 Lock을 가진다:

```python
_warehouses = {
    "A": {"stock": 100, "lock": threading.Lock()},
    "B": {"stock": 100, "lock": threading.Lock()},
}
```

문제의 코드 - Lock 순서를 호출 방향에 따라 잡는다:

```python
@router.post("/warehouse/transfer-unsafe")
def transfer_unsafe(from_wh: str = "A", to_wh: str = "B", quantity: int = 10):
    from_lock = _warehouses[from_wh]["lock"]
    to_lock = _warehouses[to_wh]["lock"]

    from_lock.acquire(timeout=5)  # 출발지 Lock 먼저
    try:
        time.sleep(0.05)          # 인위적 지연
        to_lock.acquire(timeout=5)  # 도착지 Lock 다음
        try:
            # 이동 처리
            _warehouses[from_wh]["stock"] -= quantity
            _warehouses[to_wh]["stock"] += quantity
        finally:
            to_lock.release()
    finally:
        from_lock.release()
```

A→B 요청이 오면: lock_A를 먼저 잡고, lock_B를 다음에 잡는다.
B→A 요청이 오면: lock_B를 먼저 잡고, lock_A를 다음에 잡는다.

(여기서 lock_A는 `_warehouses["A"]["lock"]`, lock_B는 `_warehouses["B"]["lock"]`이다. 코드에서는 `from_lock`, `to_lock`이라는 변수명을 쓰지만, 호출 방향에 따라 lock_A가 될 수도, lock_B가 될 수도 있다.)

두 요청이 동시에 오면:

```
Thread 1 (A→B): from_lock(=lock_A) 획득 → sleep → to_lock(=lock_B) 획득 시도
Thread 2 (B→A): from_lock(=lock_B) 획득 → sleep → to_lock(=lock_A) 획득 시도
```

Thread 1은 lock_B를 기다린다. 그런데 lock_B는 Thread 2가 잡고 있다.
Thread 2는 lock_A를 기다린다. 그런데 lock_A는 Thread 1이 잡고 있다.

둘 다 상대방이 들고 있는 Lock을 기다린다. 영원히.

이게 Deadlock이다.

해결 코드 - Lock 순서를 항상 알파벳순으로 고정:

```python
@router.post("/warehouse/transfer-safe")
def transfer_safe(from_wh: str = "A", to_wh: str = "B", quantity: int = 10):
    # 항상 알파벳순으로 Lock을 잡는다
    first_wh, second_wh = sorted([from_wh, to_wh])
    first_lock = _warehouses[first_wh]["lock"]
    second_lock = _warehouses[second_wh]["lock"]

    with first_lock:
        time.sleep(0.05)
        with second_lock:
            _warehouses[from_wh]["stock"] -= quantity
            _warehouses[to_wh]["stock"] += quantity
```

A→B든 B→A든, Lock은 항상 A → B 순서로 잡는다. Thread 1과 Thread 2 모두 lock_A를 먼저 잡으려고 한다. 둘 중 하나만 lock_A를 잡고, 그 스레드가 lock_B도 잡는다. 나머지 스레드는 lock_A부터 기다린다.

서로 다른 Lock을 들고 상대방을 기다리는 상황이 생기지 않는다. Deadlock이 원천 봉쇄된다.

왜 Lock 순서를 고정하면 Deadlock이 안 생기는가? Deadlock이 발생하려면 4가지 조건이 동시에 성립해야 하는데, 그 중 하나가 깨지기 때문이다. 다음에서 본다.

---

[< Critical Section과 Lock](./02-critical-section.md) | [왜 이렇게 되는가 - Deadlock의 조건과 Semaphore >](./04-deadlock-conditions.md)
