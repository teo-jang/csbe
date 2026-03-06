# Ch.24 종합 - 내가 만든 서비스를 처음부터 끝까지 분석하기

Part 1에서 7까지, 23개 챕터를 돌아왔다. 마지막 챕터에서는 지금까지 배운 모든 키워드를 하나의 서비스에 매핑한다.

---

Ch.1에서 이런 이야기를 했다.

```
"키워드를 모르면 검색도 못 하고, AI도 엉뚱한 답을 준다."
```

그리고 23개 챕터를 거치면서 System Call, Process, Thread, Memory Layout, Race Condition, TCP/IP, Connection Pool, Hash Table, B-Tree, ORM, Transaction, Cache, SOLID, Container, OWASP 같은 키워드를 하나씩 쌓아왔다.

그런데 잠깐 돌아보자. 이 키워드들을 개별적으로 "안다"는 것과, 이 키워드들이 하나의 서비스 안에서 어떻게 연결되는지를 "안다"는 것은 차이가 크다.

Ch.3에서 CPU Bound와 I/O Bound를 배웠다. Ch.6에서 Connection Pool을 배웠다. Ch.14에서 Index를 배웠다. 하나하나 따로 보면 다 아는 이야기다. 그런데 운영 서버가 느려졌을 때, 이 키워드들 중 어디부터 봐야 하는가? 어디서 어디로 연결되는가?

이 챕터의 목적은 그 연결을 만드는 거다.

하나의 API 요청이 들어와서 응답이 나가기까지, 어떤 레이어를 거치고, 각 레이어에서 어떤 CS 키워드가 작동하는지를 처음부터 끝까지 따라간다. 외우는 게 아니다. 전체 그림에서 자기 위치를 찾는 거다.


---

### 목차

1. [전체 키워드 총정리](./01-keyword-map.md)
2. [AI 활용 전략](./02-ai-strategy.md)
3. [마무리](./03-summary.md)

---

다음: [전체 키워드 총정리 >](./01-keyword-map.md)
