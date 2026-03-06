# Ch.19 Replica를 200개로 늘려볼까요?

인덱스도 걸었고, 캐시도 붙였고, 그래도 안 빠르다. 서버를 늘리면 되지 않을까?

Ch.17에서 캐시 전략을, Ch.18에서 계층 캐시 설계를 다뤘다. DB 최적화(Part 4)도 했고, 캐시(Ch.17~18)도 했다. 그런데 여전히 느리다. 이 시점에서 대부분의 팀이 하는 판단이 있다.

"서버를 늘리자."

이번 챕터는 Part 5의 마지막이다. "서버를 늘리면 빨라지는가?"라는 질문에 CS 관점에서 답한다. 결론부터 말하면, Bottleneck을 찾지 않고 Scale-Out하면 돈만 날린다.

---

## 이 챕터에서 다루는 것

- Scale-Out이 성능을 개선하지 못하는 시나리오
- Bottleneck(병목) 식별 방법: CPU, Memory, Disk I/O, Network, DB
- Amdahl's Law: 병렬화의 이론적 한계
- Scale-Up vs Scale-Out, 언제 뭘 쓰는가
- 성능 최적화의 올바른 순서


## 환경

Ch.16에서 사용한 환경과 거의 동일하다. 모니터링 도구만 추가된다.

| 도구 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 서버 |
| FastAPI | 0.111+ | API 서버 |
| k6 | 최신 | 부하 테스트 |
| top / htop | OS 내장 | CPU / Memory 실시간 모니터링 |
| iostat | OS 내장 | Disk I/O 모니터링 |
| MySQL | 8.0 (Docker) | DB Bottleneck 재현 |

### top/htop을 쓰는 이유

운영 환경에서는 Datadog이나 Grafana 같은 모니터링 도구를 쓴다. 하지만 top/htop은 서버에 SSH 접속만 되면 바로 볼 수 있다. 모니터링 도구가 설정되기 전, 또는 장애 상황에서 가장 먼저 확인하는 도구가 top이다. 원리를 알아야 도구가 보여주는 지표를 해석할 수 있다.

(htop은 top의 개선판이다. 색상, 프로세스 트리, 마우스 지원 등이 추가됐다. 기능은 비슷한데 보기가 훨씬 편하다. macOS에서는 `brew install htop`으로 설치한다.)

### 서버 실행

```bash
cd csbe-study && docker compose up -d
cd csbe-study && poetry install
cd csbe-study/csbe_study && poetry run uvicorn main:app --port 8765
```


## 목차

1. [사례: Scale-Out 했는데 왜 안 빨라지죠?](./01-case.md)
2. [Bottleneck과 Amdahl의 법칙](./02-bottleneck-amdahl.md)
3. [유사 사례와 키워드 정리](./03-summary.md)

---

다음: [사례: Scale-Out 했는데 왜 안 빨라지죠? >](./01-case.md)
