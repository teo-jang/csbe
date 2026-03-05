# Ch.5 사례 A: 재고가 마이너스가 됐는데, 코드 상으로는 불가능한데요?

[< 환경 세팅](./README.md) | [왜 이렇게 되는가 - Critical Section과 Lock >](./02-critical-section.md)

---

Ch.4에서 스레드는 Heap을 공유한다는 걸 확인했다. ThreadPool 16개를 만들어도 메모리가 거의 안 늘어나는 건 이 공유 덕분이었다. 그런데 이 공유가 문제를 일으키는 경우가 있다.


## 5-1. 사례 설명

쇼핑몰의 한정 수량 이벤트 API를 만든다. 재고 100개짜리 상품이 있다. 이벤트 시작과 동시에 구매 요청이 쏟아진다.

개발자가 작성한 코드의 핵심 로직은 이렇다:

```python
if stock >= quantity:
    stock -= quantity
    return "구매 성공"
else:
    return "품절"
```

논리적으로 완벽해 보인다. `stock >= quantity` 체크가 있으니까, stock이 0 아래로 내려갈 수가 없다. 개발 환경에서 테스트했더니 잘 돌아간다. 재고 100개에 120번 구매 요청을 보내면 100번 성공하고 20번 "품절"이 뜬다.

이벤트 당일. 수십 명이 동시에 구매 버튼을 누른다.

결과: 재고가 -31이 됐다.

"코드에 if 체크가 있는데 어떻게 마이너스가 되는 거지? 버그인가?"


## 5-2. 결과 예측

- "재고 100개, 50명이 동시에 1개씩 3번 구매하면 총 150건의 요청이 온다. 최종 재고는 얼마인가?"
- "if 체크가 있는데 왜 음수가 되는가?"
- "Lock을 걸면 해결되는가?"

<!-- 기대 키워드: Race Condition, Critical Section, Atomicity, Thread, Heap, Mutex -->


## 5-3. 결과 분석

k6로 50 VUs(가상 사용자)가 동시에 각 3번씩 구매 요청을 보냈다. 재고는 100개.

| 시나리오 | 총 요청 | 성공 (차감) | 실패 (품절) | 최종 재고 | 기대 재고 | 비고 |
|----------|---------|-----------|-----------|----------|----------|------|
| unsafe (Lock 없음) | 150 | 131 | 19 | -31 | 0 이상 | Race Condition |
| safe (Lock 있음) | 50 | 50 | 0 | 50 | 50 | 정상 |

측정 환경: M1 Mac, Python 3.12, FastAPI 0.111, uvicorn, k6 50 VUs

unsafe에서 무슨 일이 벌어진 건가?

재고 100개인데 131건이 성공했다. 31건이 초과 판매된 거다. if 체크가 있는데 왜 이런 일이 벌어지는가? 코드에 버그가 있는 건 아니다. 단일 스레드에서는 완벽하게 동작한다. 문제는 여러 스레드가 같은 데이터를 동시에 건드릴 때 발생한다.

safe(Lock 있음)에서는 50건 요청에 50건 성공, 재고 정확히 50. Lock이 동시 접근을 막아줬다.


## 5-4. 코드 설명

먼저 공유 상태를 선언한다. 이게 모듈 레벨 변수, 즉 Heap에 위치한다:

```python
_inventory = {
    "stock": 100,
    "success_count": 0,
    "fail_count": 0,
}
_inventory_lock = threading.Lock()
```

Ch.4에서 배웠다. 스레드는 Heap을 공유한다. FastAPI에서 `def`로 정의한 엔드포인트는 ThreadPool에서 실행된다. 여러 요청이 동시에 들어오면 여러 스레드가 동시에 같은 `_inventory` dict에 접근한다.

문제의 코드 - Lock 없이 재고를 차감:

```python
@router.post("/inventory/purchase-unsafe")
def purchase_unsafe(quantity: int = 1):
    # 1) 현재 재고를 읽는다
    current_stock = _inventory["stock"]

    # 2) 인위적 지연 (Race Condition이 발생할 수 있는 시간 틈새를 넓힌다)
    time.sleep(0.01)

    # 3) 재고 체크 (stale 값으로 비교)
    if current_stock >= quantity:
        # 4) 차감
        _inventory["stock"] -= quantity
        _inventory["success_count"] += 1
        return {"result": "success", ...}
    else:
        _inventory["fail_count"] += 1
        return {"result": "sold_out", ...}
```

이 코드의 문제는 "읽기 → 체크 → 쓰기"가 하나의 묶음으로 실행되지 않는다는 거다.

무슨 일이 벌어지는지 시간순으로 보자:

1. Thread A가 stock을 읽는다: `current_stock = 1`
2. Thread B가 stock을 읽는다: `current_stock = 1`
3. Thread A가 체크한다: `1 >= 1` → True
4. Thread B가 체크한다: `1 >= 1` → True (Thread B도 같은 값 1을 읽었으니까)
5. Thread A가 차감한다: `stock -= 1` → stock = 0
6. Thread B가 차감한다: `stock -= 1` → stock = -1

재고가 1개였는데 2개가 팔렸다. 두 스레드가 같은 "오래된 값"을 읽고, 둘 다 통과하고, 둘 다 차감했다. `time.sleep(0.01)`이 이 창(window)을 넓혀서 문제가 확실하게 재현된다.

(time.sleep()은 GIL을 해제한다. GIL이 뭔지는 Ch.3에서 배웠다. sleep()을 호출하면 "나는 잠깐 쉴게, 다른 스레드가 실행해"라고 양보하는 거다. 이 때 다른 스레드가 같은 코드를 실행하면서 Race Condition이 발생한다. 실제 서비스에서는 이 sleep이 없어도 Race Condition은 발생한다. 다만 타이밍 창이 훨씬 짧아서 재현 확률이 낮을 뿐이다. 여기서는 확실한 재현을 위해 인위적으로 넓힌 거다.)

해결 코드 - Lock으로 보호:

```python
@router.post("/inventory/purchase-safe")
def purchase_safe(quantity: int = 1):
    with _inventory_lock:  # Lock 획득 (다른 스레드는 여기서 대기)
        current_stock = _inventory["stock"]
        time.sleep(0.01)  # 같은 지연이지만 Lock 안에서 실행

        if current_stock >= quantity:
            _inventory["stock"] -= quantity
            _inventory["success_count"] += 1
            return {"result": "success", ...}
        else:
            _inventory["fail_count"] += 1
            return {"result": "sold_out", ...}
    # Lock 해제 (with 블록을 나오면 자동으로)
```

`with _inventory_lock:`가 하는 일: "읽기 → 체크 → 쓰기"를 하나의 묶음으로 만든다. Thread A가 이 묶음을 실행하는 동안 Thread B는 Lock이 풀릴 때까지 기다린다. Thread A가 끝나야 Thread B가 들어온다.

"그런데 GIL이 있으면 한 번에 하나의 스레드만 Python 코드를 실행하는 거 아닌가? 그러면 Race Condition이 안 생기는 거 아닌가?"

아니다. GIL은 CPython 인터프리터의 내부 자료구조를 보호할 뿐이다. GIL은 일정 시간 간격(기본 5ms, `sys.getswitchinterval()`)마다 다른 스레드에게 실행 기회를 준다. `_inventory["stock"] -= 1`은 bytecode로 10단계에 달하는 복합 연산이다 (LOAD → SUBSCR → BINARY_OP → STORE). 이 단계들 사이에 다른 스레드로 전환될 수 있다. 게다가 `time.sleep()`은 GIL을 명시적으로 해제하니까, sleep 이후의 코드는 다른 스레드와 완전히 경쟁 상태가 된다.

GIL은 "Python 인터프리터의 자기 보호용"이다. 개발자의 데이터를 보호해주는 게 아니다.

왜 이런 일이 벌어지는지, CS 관점에서 파고든다.

---

[< 환경 세팅](./README.md) | [왜 이렇게 되는가 - Critical Section과 Lock >](./02-critical-section.md)
