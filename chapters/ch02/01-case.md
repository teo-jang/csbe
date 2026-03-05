# Ch.2 사례: print를 뺐더니 수십 배 빨라졌다

[< 환경 세팅](./README.md) | [CS Drill Down (1) >](./02-print-internals.md)

---

환경이 준비됐으면 사례부터 보자.

## 2-1. 사례 설명

상황을 하나 그려보자.

신입 개발자가 문자열 처리 API를 만들고 있다. 입력값을 받아서 가공한 뒤 돌려주는, 로직 자체는 별거 아닌 API다. 개발 중에 값이 제대로 들어오는지 확인하고 싶어서 `print()` 문을 여기저기 넣었다. 글자 하나 처리할 때마다 중간 결과를 `print()`로 찍어봤다. 로컬에서 잘 돌아가는 걸 확인하고, print를 그대로 둔 채 개발 서버에 배포했다.

(print 디버깅. 솔직히 한 번도 안 해본 사람이 있을까? 이 강의 작성자도 아직 가끔 한다. 간편하니까.)

며칠 뒤 성능 테스트를 돌렸더니 응답이 엄청 느리다. 코드 로직이 복잡한 것도 아닌데 왜 이렇게 느리지? 혹시 DB 쿼리가 느린 건가? 네트워크 문제인가? 이것저것 의심하며 반나절을 보냈다.

옆자리 선배가 코드를 슬쩍 보더니 한마디 한다.

"print 좀 빼봐."

반신반의하며 `print()` 문만 주석 처리했다. 코드 로직은 한 글자도 안 바꿨다. 그런데 성능 테스트를 다시 돌리니까, 응답이 수십 배 빨라졌다.

"아니, print가 뭐길래?"


## 2-2. 사례에 대한 결과 예측

여기서 질문을 하나 던진다.

`print()` 문을 빼면 얼마나 빨라질 것 같은가?

- 2배? 5배? 10배?
- 아니면 별 차이 없을 것 같은가?
- 차이가 난다면, 왜 차이가 난다고 생각하는가?

잠시 생각해보고, 아래 결과와 비교해보자.

<!-- 기대 키워드: System Call, Kernel Mode, I/O, write(), stdout, File Descriptor -->


## 2-3. 사례에 대한 결과 분석

아래는 동일한 로직에서 `print()` 유무만 다른 두 API를 100명의 동시 사용자로 10초간 부하 테스트한 결과다.

| 지표 | print 있음 (doPrint) | print 없음 (dontPrint) | 배율 |
|------|---------------------|----------------------|------|
| 평균 응답 시간 | 2,160ms | 15.4ms | ~140x |
| p95 응답 시간 | 3,720ms | 23.4ms | ~159x |
| 초당 처리량 (req/s) | 29 | 98 | ~3.4x |

(측정 환경: M1 MacBook, Python 3.12, uvicorn, PYTHONUNBUFFERED=1, k6 100 VUs / 10s)

<details>
<summary>Throughput (처리량)</summary>

단위 시간당 처리할 수 있는 작업의 양이다. 보통 req/s(requests per second, 초당 요청 수)로 표현한다.
"1초에 몇 건을 처리할 수 있는가"를 나타내는 지표로, 높을수록 좋다.
비유하자면 고속도로의 차선 수와 비슷하다. 차선이 넓을수록 같은 시간에 더 많은 차가 지나간다.

</details>

<details>
<summary>Latency (지연 시간)</summary>

요청을 보낸 시점부터 응답을 받는 시점까지 걸리는 시간이다. 보통 ms(밀리초) 단위로 표현한다.
"한 건의 요청이 얼마나 빨리 처리되는가"를 나타내는 지표로, 낮을수록 좋다.
Throughput과 Latency는 서로 다른 축이다. Throughput이 높아도 Latency가 높을 수 있고, 그 반대도 가능하다.

</details>

평균 응답 시간 기준으로 약 140배 차이다. 코드 로직은 똑같은데, `print()` 유무만으로 이 정도 차이가 난다. 환경에 따라 수치는 다르겠지만, 수십 배에서 수백 배 차이가 나는 방향성은 동일하다.

"응답 시간은 140배 차이인데 처리량은 3.4배밖에 안 나는데?" 좋은 의문이다. 이건 k6 테스트에 `sleep(1)`이 있어서 그렇다. 각 VU가 요청 후 1초를 쉬기 때문에, 느린 버전(2.16초 + 1초 대기 = VU당 약 3.16초/건)이든 빠른 버전(0.015초 + 1초 대기 = VU당 약 1.015초/건)이든 처리량의 상한이 비슷해진다. 100 VU에서 이론적 상한은 약 100 req/s다. 처리량보다 응답 시간에 주목하는 게 이 테스트의 핵심이다.

한 줄 요약: print() 하나가 API 응답을 수십~수백 배 느리게 만들 수 있다. 왜?

왜 이런 일이 벌어지는지 코드부터 보자.


## 2-4. 사례에 대한 코드 설명

테스트에 사용된 FastAPI 서버 코드다. 이번 챕터에서 볼 부분만 발췌했다.

`csbe-study/csbe_study/routers/printer.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/print", tags=["print"])


@router.get("/doPrint/{message}")
def print_sync(message: str):
    ret = ""
    for _ in range(100):           # 100번 반복
        for i in range(len(message)):  # 메시지의 글자 하나하나
            ret += message[i]
            print(message[i])      # 글자마다 print 호출

    return {"message": ret}


@router.get("/dontPrint/{message}")
def return_sync(message: str):
    ret = ""
    for _ in range(100):           # 동일한 100번 반복
        for i in range(len(message)):  # 동일한 글자 순회
            ret += message[i]
            # print 없음

    return {"message": ret}
```

두 함수의 차이는 딱 한 줄, `print(message[i])`의 유무뿐이다. 나머지 로직은 완전히 동일하다.

(참고: 실제 파일에는 `doPrintAsync` 엔드포인트도 있다. 이건 Ch.3에서 async를 다룰 때 사용한다.)

(참고: `ret += message[i]`라는 문자열 결합 방식 자체에도 성능 이슈가 있다. 이건 자료구조 챕터에서 다시 다룬다.)

이제 k6 테스트 스크립트를 보자.

`csbe-study/k6/printer/240601_io_performance_test.js` (print 있는 버전):

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 100,        // 동시 사용자 100명
  duration: '10s', // 10초 동안 테스트
};

export default function() {
  http.get('http://127.0.0.1:8000/print/doPrint/' + generateUUID());
  sleep(1); // 요청 사이에 1초 대기 (실제 사용자의 행동을 모사)
}

// 매 요청마다 고유한 문자열을 생성하기 위한 함수
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
```

<details>
<summary>VU (Virtual User, 가상 사용자)</summary>

부하 테스트에서 실제 사용자를 흉내 내는 가상의 클라이언트다.
VU가 100이면 "100명이 동시에 API를 호출하는 상황"을 시뮬레이션하는 것이다.
각 VU는 독립적으로 요청을 보내고 응답을 받는다.
실제 서비스에서 동시 접속자 수를 예측할 때 이 개념이 중요하다.

</details>

`sleep(1)`은 각 VU가 요청을 보낸 뒤 1초를 기다린 다음 다시 요청을 보내도록 하는 설정이다. 실제 사용자가 API를 쉬지 않고 연타하지 않는 것처럼, 요청 사이에 간격(think time)을 두는 거다. 이걸 빼면 서버에 훨씬 더 강한 부하가 걸리고 결과도 달라지니, 테스트 목적에 맞게 조절하면 된다.

print 없는 버전(`240601_without_io_performance_test.js`)은 URL만 `dontPrint`로 바뀌고 나머지는 동일하다.

실행 방법:

```bash
# 1. 서버 실행 (csbe-study/csbe_study 디렉토리에서)
cd csbe-study/csbe_study
PYTHONUNBUFFERED=1 poetry run uvicorn main:app

# 2. 다른 터미널에서 k6 테스트 실행 (csbe-study 디렉토리에서)
cd csbe-study

# print 있는 버전
k6 run k6/printer/240601_io_performance_test.js

# print 없는 버전
k6 run k6/printer/240601_without_io_performance_test.js
```

(`PYTHONUNBUFFERED=1`이 뭔지는 [03-syscall-cost.md](./03-syscall-cost.md)의 Buffer 섹션에서 설명한다. 지금은 "벤치마크 결과를 정확하게 만들기 위한 설정"이라고만 알아두면 된다.)

직접 돌려보고, 2-3의 표를 채워보자. k6가 테스트 끝나면 결과 요약을 보여주는데, 봐야 할 항목은 이 정도다:

- `http_req_duration`: 응답 시간. avg(평균), p(95)(상위 5% 응답 시간)를 본다
- `http_reqs`: 총 요청 수와 초당 처리량(rate)
- `http_req_failed`: 실패율. 이게 0%가 아니면 서버가 에러를 반환한 것이다. 결과가 이상하면 이걸 먼저 확인한다

내 참고 수치와 비교해서 비슷한 범위에 있으면 정상이다.

코드는 이게 전부다. 문자열 연결하는 루프와 print() 한 줄. 그런데 그 한 줄이 140배 차이를 만든다. print()가 내부적으로 뭘 하길래 이러는 건지, 겉에서부터 한 겹씩 벗겨보자.

---

[< 환경 세팅](./README.md) | [CS Drill Down (1) - print()는 어디로 가는가 >](./02-print-internals.md)
