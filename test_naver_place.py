#!/usr/bin/env python3
"""네이버 플레이스 메뉴 수집 구조 테스트"""

import urllib.request
import urllib.parse
import json
import ssl

import certifi
ctx = ssl.create_default_context(cafile=certifi.where())

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://map.naver.com/",
}

def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_text(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        return resp.read().decode("utf-8")

print("=== 네이버 플레이스 메뉴 수집 테스트 ===\n")

# 1. 네이버 지역 검색 API (비공식)
query = "BBQ 제주한경점"
encoded = urllib.parse.quote(query)

print(f"[1] 네이버 검색: {query}")
try:
    # 네이버 지도 검색 API
    search_url = f"https://map.naver.com/p/api/search/allSearch?query={encoded}&type=all&searchCoord=126.2;33.3&boundary="
    data = fetch_json(search_url)
    places = data.get("result", {}).get("place", {}).get("list", [])
    print(f"    결과: {len(places)}개")
    for p in places[:5]:
        print(f"    - {p.get('name')} | {p.get('address')} | ID: {p.get('id')}")
except Exception as e:
    print(f"    실패: {e}")
    # 대안: 네이버 검색 API v2
    try:
        search_url2 = f"https://map.naver.com/v5/api/search?caller=pcweb&query={encoded}&type=all&page=1&displayCount=20"
        data = fetch_json(search_url2)
        places = data.get("result", {}).get("place", {}).get("list", [])
        print(f"    v5 API 결과: {len(places)}개")
        for p in places[:5]:
            print(f"    - {p.get('name')} | {p.get('address')} | ID: {p.get('id')}")
    except Exception as e2:
        print(f"    v5 API도 실패: {e2}")
        places = []

print()

# 2. 네이버 플레이스 상세 API (place ID가 있을 때)
if places:
    place_id = places[0].get("id", "")
    print(f"[2] 상세 페이지: {places[0].get('name')} (ID: {place_id})")

    # 상세 정보 API
    try:
        detail_url = f"https://map.naver.com/p/api/restaurants/{place_id}/menu"
        menu_data = fetch_json(detail_url)
        print(f"    메뉴 API 응답: {json.dumps(menu_data, ensure_ascii=False)[:500]}")
    except Exception as e:
        print(f"    메뉴 API 실패: {e}")

    # 대안: place 상세 API
    try:
        detail_url2 = f"https://map.naver.com/p/api/sites/summary/{place_id}?lang=ko"
        detail_data = fetch_json(detail_url2)
        print(f"    요약 API: {json.dumps(detail_data, ensure_ascii=False)[:500]}")
    except Exception as e:
        print(f"    요약 API 실패: {e}")

    # 대안: place v2
    try:
        detail_url3 = f"https://pcmap-api.place.naver.com/place/graphql"
        # GraphQL은 복잡하므로 REST 먼저
        detail_url3 = f"https://map.naver.com/p/entry/place/{place_id}?c=15.00,0,0,0,dh"
        html = fetch_text(detail_url3)
        print(f"    HTML 크기: {len(html)} bytes")

        # __NEXT_DATA__ 추출
        import re
        next_data_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if next_data_match:
            next_data = json.loads(next_data_match.group(1))
            print(f"    __NEXT_DATA__ 발견!")
            # 메뉴 데이터 탐색
            props = next_data.get("props", {}).get("pageProps", {})
            print(f"    pageProps keys: {list(props.keys())[:10]}")
        else:
            print(f"    __NEXT_DATA__ 없음")
    except Exception as e:
        print(f"    entry 페이지 실패: {e}")

print()

# 3. 네이버 플레이스 GraphQL API 테스트
print("[3] GraphQL API 테스트")
if places:
    place_id = places[0].get("id", "")
    try:
        gql_url = "https://pcmap-api.place.naver.com/graphql"
        gql_body = json.dumps([{
            "operationName": "getMenuItems",
            "variables": {"input": {"businessId": place_id, "isNx": False, "display": 50, "start": 1}},
            "query": "query getMenuItems($input: MenuItemsInput) { menuItems(input: $input) { total items { name price description images { url } } } }"
        }]).encode("utf-8")

        req = urllib.request.Request(gql_url, data=gql_body, headers={
            **HEADERS,
            "Content-Type": "application/json",
            "Referer": f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list",
        })
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            gql_data = json.loads(resp.read().decode("utf-8"))
        print(f"    GraphQL 응답: {json.dumps(gql_data, ensure_ascii=False)[:800]}")
    except Exception as e:
        print(f"    GraphQL 실패: {e}")

    # 대안 GraphQL 쿼리
    try:
        gql_body2 = json.dumps([{
            "operationName": "getRestaurant",
            "variables": {"input": {"id": place_id}},
            "query": "query getRestaurant($input: RestaurantInput) { restaurant(input: $input) { id name menus { name price description } } }"
        }]).encode("utf-8")

        req2 = urllib.request.Request(gql_url, data=gql_body2, headers={
            **HEADERS,
            "Content-Type": "application/json",
            "Referer": f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list",
        })
        with urllib.request.urlopen(req2, context=ctx, timeout=10) as resp2:
            gql_data2 = json.loads(resp2.read().decode("utf-8"))
        print(f"    GraphQL v2 응답: {json.dumps(gql_data2, ensure_ascii=False)[:800]}")
    except Exception as e:
        print(f"    GraphQL v2 실패: {e}")

print("\n=== 테스트 완료 ===")
