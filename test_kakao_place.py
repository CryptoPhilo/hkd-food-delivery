#!/usr/bin/env python3
"""카카오맵 place_url 상세 페이지에서 메뉴 수집 테스트"""

import urllib.request
import urllib.parse
import json
import re
import ssl

import os
import certifi
ctx = ssl.create_default_context(cafile=certifi.where())

KAKAO_KEY = os.environ.get("KAKAO_REST_API_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

def fetch(url, headers=None):
    h = {**HEADERS}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")

def kakao_search(query):
    """카카오 키워드 검색으로 place ID 가져오기"""
    encoded = urllib.parse.quote(query)
    url = f"https://dapi.kakao.com/v2/local/search/keyword.json?query={encoded}&size=3"
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {KAKAO_KEY}"})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("documents", [])

def scrape_kakao_place(place_id):
    """카카오맵 상세 페이지에서 메뉴 수집"""
    url = f"https://place.map.kakao.com/{place_id}"
    print(f"  URL: {url}")

    html = fetch(url)
    print(f"  HTML: {len(html)} bytes")

    menus = []

    # 1. JSON 데이터 내장 확인
    # 카카오 place 페이지는 __LOADDATA__ 또는 initialProps 등에 JSON 포함
    json_patterns = [
        r'window\.__LOADDATA__\s*=\s*(\{.*?\});?\s*</script>',
        r'window\.__NEXT_DATA__\s*=\s*(\{.*?\});?\s*</script>',
        r'"menuInfo"\s*:\s*(\{[^}]*\})',
        r'"menu"\s*:\s*(\[.*?\])',
    ]

    for pat in json_patterns:
        matches = re.findall(pat, html, re.DOTALL)
        if matches:
            print(f"  패턴 매칭: {pat[:40]}... ({len(matches)}개)")
            for m in matches[:1]:
                try:
                    data = json.loads(m)
                    print(f"    데이터 keys: {list(data.keys())[:10] if isinstance(data, dict) else f'배열 {len(data)}개'}")
                    print(f"    미리보기: {json.dumps(data, ensure_ascii=False)[:500]}")
                except:
                    print(f"    JSON 파싱 실패, 원문: {m[:200]}...")

    # 2. menuInfo 탐색 (카카오 place 페이지 구조)
    menu_section = re.search(r'"menuInfo"\s*:\s*(\{.*?"list"\s*:\s*\[.*?\]\s*\})', html, re.DOTALL)
    if menu_section:
        try:
            menu_data = json.loads(menu_section.group(1))
            menu_list = menu_data.get("list", [])
            print(f"  menuInfo 발견: {len(menu_list)}개")
            for item in menu_list[:10]:
                name = item.get("menu", "") or item.get("name", "")
                price = item.get("price", "")
                print(f"    - {name}: {price}")
                menus.append({"name": name, "price": price})
        except Exception as e:
            print(f"  menuInfo 파싱 실패: {e}")

    # 3. 전체 JSON blob에서 menu 키 검색
    all_json_blobs = re.findall(r'\{[^{}]{50,}\}', html)
    menu_found = False
    for blob in all_json_blobs:
        if '"menu"' in blob or '"menuList"' in blob or '"menuInfo"' in blob:
            if not menu_found:
                print(f"  menu 키 포함 JSON 발견: {blob[:300]}...")
                menu_found = True

    # 4. HTML 파싱으로 메뉴 찾기
    menu_html = re.findall(r'class="[^"]*menu[^"]*"[^>]*>(.*?)</(?:div|li|span|ul)', html, re.DOTALL | re.IGNORECASE)
    if menu_html:
        print(f"  HTML menu 클래스: {len(menu_html)}개")
        for mh in menu_html[:5]:
            clean = re.sub(r'<[^>]+>', ' ', mh).strip()
            if clean:
                print(f"    {clean[:100]}")

    # 5. 가격 패턴으로 메뉴 후보 찾기
    price_patterns = re.findall(r'(\d{1,3}(?:,\d{3})+)\s*원', html)
    if price_patterns:
        print(f"  가격 패턴: {price_patterns[:10]}")

    # 6. place.map.kakao.com API 시도
    api_urls = [
        f"https://place.map.kakao.com/main/v/{place_id}",
        f"https://place.map.kakao.com/api/v1/place/{place_id}",
    ]
    for api_url in api_urls:
        try:
            raw = fetch(api_url, headers={"Accept": "application/json"})
            if raw.startswith("{") or raw.startswith("["):
                data = json.loads(raw)
                print(f"\n  API {api_url}")
                if isinstance(data, dict):
                    print(f"    keys: {list(data.keys())[:15]}")
                    # menuInfo 확인
                    if "menuInfo" in data:
                        mi = data["menuInfo"]
                        print(f"    menuInfo: {json.dumps(mi, ensure_ascii=False)[:500]}")
                    if "menu" in data:
                        print(f"    menu: {json.dumps(data['menu'], ensure_ascii=False)[:500]}")
                    # 전체 데이터 일부 출력
                    print(f"    전체: {json.dumps(data, ensure_ascii=False)[:600]}")
            else:
                print(f"\n  API {api_url} → HTML ({len(raw)} bytes)")
        except Exception as e:
            print(f"\n  API {api_url} → {e}")

    return menus


# 테스트
tests = ["BBQ 제주한경점", "올래국수 제주", "스타벅스 한림점"]

print("=== 카카오맵 place 메뉴 수집 테스트 ===\n")

for query in tests:
    print(f"{'='*55}")
    print(f"검색: {query}")
    print(f"{'='*55}")

    try:
        places = kakao_search(query)
        if places:
            p = places[0]
            place_id = p["id"]
            print(f"  식당: {p['place_name']} | {p['address_name']}")
            print(f"  place_url: {p.get('place_url', '')}")
            print(f"  place_id: {place_id}")
            print()
            menus = scrape_kakao_place(place_id)
            if menus:
                print(f"\n  === 수집된 메뉴: {len(menus)}개 ===")
                for m in menus:
                    print(f"    {m['name']}: {m['price']}")
            else:
                print(f"\n  === 메뉴 수집 실패 ===")
        else:
            print("  검색 결과 없음")
    except Exception as e:
        print(f"  오류: {e}")
    print()

print("=== 테스트 완료 ===")
