# Ch.11 사례 - 매 요청마다 정렬하는 API

[< 환경 세팅](./README.md) | [Binary Search와 B-Tree >](./02-binary-search-btree.md)

---

앞에서 자료구조 선택이 검색 성능을 수천 배 바꾼다는 걸 봤다. 이번에는 정렬이다. 정렬은 검색의 전제 조건이기도 하다.


## 11-1. 사례 설명

주니어 개발자가 상품 목록 API를 만들고 있다. 가격순 정렬 기능이 필요하다.

```python
@app.get("/products")
async def get_products(sort_by: str = "price"):
    products = db.query("SELECT * FROM products")  # 10만 건

    if sort_by == "price":
        products.sort(key=lambda p: p["price"])
    elif sort_by == "name":
        products.sort(key=lambda p: p["name"])

    return products[:20]  # 상위 20개만 반환
```

10만 건을 전부 가져와서, 전부 정렬하고, 상위 20개만 반환한다. 매 요청마다.

개발 환경에서는 데이터가 1,000건이라 빠르다. 운영에 10만 건이 쌓이면?


## 11-2. 결과 예측

- 10만 건 정렬의 시간 복잡도는?
- Python의 `sort()`는 어떤 알고리즘을 쓰는가?
- `ORDER BY price LIMIT 20`을 DB에서 직접 하면 얼마나 빠를까?
- DB에 인덱스가 있다면?

<!-- 기대 키워드: Tim Sort, O(n log n), Binary Search, B-Tree, Index, ORDER BY -->


## 11-3. 결과 분석

Python의 `list.sort()`는 Tim Sort를 사용한다. 시간 복잡도는 O(n log n)이다.

| 방식 | 시간 복잡도 | 10만 건 기준 |
|------|-----------|------------|
| 애플리케이션에서 전체 정렬 | O(n log n) | ~170만 번 비교 |
| DB ORDER BY + LIMIT (인덱스 없음) | O(n log n) | DB에서 정렬 (더 빠르지만 여전히 전체 스캔) |
| DB ORDER BY + LIMIT (인덱스 있음) | O(log n + k) | 인덱스에서 20건만 바로 추출 |

인덱스가 있으면 10만 건을 정렬할 필요가 없다. 이미 정렬된 상태(B-Tree)에서 앞에서 20개만 가져오면 된다.

이 문제의 핵심은 "정렬을 누가 하는가"가 아니라 "정렬을 할 필요가 있는가"다.


## 11-4. 코드 설명

```python
# 나쁜 코드: 애플리케이션에서 전체 정렬
products = db.query("SELECT * FROM products")  # 10만 건 전체를 메모리로
products.sort(key=lambda p: p["price"])          # O(n log n) 정렬
return products[:20]                             # 20개만 사용

# 좋은 코드: DB에서 정렬 + 제한
products = db.query("SELECT * FROM products ORDER BY price LIMIT 20")

# 더 좋은 코드: price 컬럼에 인덱스가 걸려 있으면
# CREATE INDEX idx_products_price ON products(price);
# → ORDER BY price LIMIT 20이 O(log n + 20)
```

"DB로 내려라"가 정답인 경우가 대부분이다. 10만 건을 네트워크로 전송하는 비용도 문제고, 애플리케이션 메모리도 문제다.

그런데 왜 인덱스가 있으면 더 빠른가? B-Tree가 이미 정렬된 상태를 유지하기 때문이다. 다음에서 Binary Search와 B-Tree를 본다.

---

[< 환경 세팅](./README.md) | [Binary Search와 B-Tree >](./02-binary-search-btree.md)
