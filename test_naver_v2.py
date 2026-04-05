#!/usr/bin/env python3
"""네이버 플레이스 메뉴 수집 - 다양한 엔드포인트 테스트"""

import urllib.request
import urllib.parse
import json
import re
import ssl

import certifi
ctx = ssl.create_default_context(cafile=certifi.where())

def fetch(url, headers=None, data=None):
    h = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h, data=data)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")

query = "BBQ 제주한경점"
encoded = urllib.parse.quote(query)

print("=== 네이버 플레이스 API 테스트 ===\n")

# 1. 네이버 지도 검색 (새 URL 패턴들)
endpoints = [
    f"https://map.naver.com/p/api/search/allSearch?query={encoded}&type=all",
    f"https://map.naver.com/v5/api/search?caller=pcweb&query={encoded}&type=all&page=1&displayCount=10",
    f"https://m.map.naver.com/search2/searchMore.naver?query={encoded}&sm=hty&style=v5",
]

place_id = None
for i, url in enumerate(endpoints):
    print(f"[{i+1}] {url[:80]}...")
    try:
        raw = fetch(url, headers={"Accept": "application/json"})
        data = json.loads(raw)
        # 다양한 응답 구조 탐색
        for path in [
            lambda d: d.get("result",{}).get("place",{}).get("list",[]),
            lambda d: d.get("result",{}).get("place",{}).get("items",[]),
            lambda d: d.get("place",{}).get("list",[]),
            lambda d: d.get("items",[]),
            lambda d: d.get("data",[]),
        ]:
            try:
                items = path(data)
                if items:
                    print(f"    결과: {len(items)}개")
                    for p in items[:3]:
                        pid = p.get("id") or p.get("sid") or p.get("nid") or ""
                        name = p.get("name") or p.get("title") or ""
                        addr = p.get("address") or p.get("roadAddress") or ""
                        print(f"      - {name} | {addr} | ID:{pid}")
                        if not place_id and pid:
                            place_id = str(pid)
                    break
            except:
                pass
        else:
            print(f"    데이터 없음 (keys: {list(data.keys())[:5]})")
    except Exception as e:
        print(f"    실패: {e}")

print()

# 2. 네이버 검색 HTML에서 place ID 추출
print("[4] 네이버 통합검색에서 place ID 추출...")
try:
    search_html = fetch(f"https://search.naver.com/search.naver?query={encoded}&where=nexearch")
    # place ID 패턴
    pids = re.findall(r'"id"\s*:\s*"(\d+)"', search_html)
    pids2 = re.findall(r'place/(\d+)', search_html)
    pids3 = re.findall(r'sid=(\d+)', search_html)
    all_pids = list(set(pids + pids2 + pids3))
    print(f"    발견된 place ID: {all_pids[:5]}")
    if all_pids and not place_id:
        place_id = all_pids[0]
except Exception as e:
    print(f"    실패: {e}")

print()

# 3. place ID가 있으면 메뉴 수집 시도
if place_id:
    print(f"=== place ID: {place_id} 로 메뉴 수집 ===\n")

    # 3a. GraphQL API
    print("[5] GraphQL 메뉴 API...")
    gql_queries = [
        # 쿼리 1
        [{
            "operationName": "getMenuItems",
            "variables": {"input": {"businessId": place_id, "isNx": False, "display": 50, "start": 1}},
            "query": "query getMenuItems($input: MenuItemsInput) { menuItems(input: $input) { total items { name price description images { url } } } }"
        }],
        # 쿼리 2
        [{
            "operationName": "getRestaurantDetail",
            "variables": {"id": place_id},
            "query": "query getRestaurantDetail($id: String!) { restaurant(id: $id) { name menus { name price } } }"
        }],
    ]

    for qi, gql in enumerate(gql_queries):
        try:
            body = json.dumps(gql).encode("utf-8")
            raw = fetch("https://pcmap-api.place.naver.com/graphql", headers={
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Referer": f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list",
                "Origin": "https://pcmap.place.naver.com",
            }, data=body)
            result = json.loads(raw)
            print(f"    GQL-{qi+1}: {json.dumps(result, ensure_ascii=False)[:600]}")
        except Exception as e:
            print(f"    GQL-{qi+1} 실패: {e}")

    print()

    # 3b. 플레이스 페이지 직접 접근
    print("[6] 플레이스 HTML 페이지...")
    place_urls = [
        f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list",
        f"https://m.place.naver.com/restaurant/{place_id}/menu/list",
        f"https://map.naver.com/p/entry/place/{place_id}",
    ]

    for url in place_urls:
        try:
            html = fetch(url)
            print(f"    {url[:60]}... → {len(html)} bytes")

            # __NEXT_DATA__ 추출
            nd_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
            if nd_match:
                nd = json.loads(nd_match.group(1))
                props = nd.get("props", {}).get("pageProps", {})
                print(f"      __NEXT_DATA__ keys: {list(props.keys())[:8]}")

                # initialState에서 메뉴 찾기
                state = props.get("initialState", {})
                if state:
                    print(f"      initialState keys: {list(state.keys())[:8]}")
                    menu_state = state.get("menu") or state.get("menus") or {}
                    if menu_state:
                        print(f"      menu 데이터: {json.dumps(menu_state, ensure_ascii=False)[:500]}")

                # dehydratedState
                dehy = nd.get("props", {}).get("pageProps", {}).get("dehydratedState", {})
                if dehy:
                    queries = dehy.get("queries", [])
                    print(f"      dehydratedState queries: {len(queries)}개")
                    for q in queries[:3]:
                        qkey = q.get("queryKey", "")
                        qdata = q.get("state", {}).get("data", "")
                        if qdata:
                            data_str = json.dumps(qdata, ensure_ascii=False)[:300]
                            print(f"        key: {qkey} → {data_str}")
            else:
                # JSON-LD 확인
                ld_matches = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
                if ld_matches:
                    for m in ld_matches:
                        try:
                            ld = json.loads(m)
                            if ld.get("hasMenu"):
                                print(f"      ld+json 메뉴 발견: {json.dumps(ld['hasMenu'], ensure_ascii=False)[:400]}")
                        except:
                            pass
                print(f"      __NEXT_DATA__ 없음, ld+json {len(ld_matches)}개")
            break  # 첫 번째 성공한 것만
        except Exception as e:
            print(f"    {url[:60]}... → 실패: {e}")

else:
    print("place ID를 찾지 못했습니다.")

print("\n=== 테스트 완료 ===")
