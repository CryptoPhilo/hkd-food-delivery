#!/usr/bin/env python3
"""구글 검색 → 다이닝코드 상세페이지 → 메뉴 수집 테스트"""

import urllib.request
import urllib.parse
import json
import re
import ssl

import certifi
ctx = ssl.create_default_context(cafile=certifi.where())

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


def google_search_diningcode(restaurant_name, address=""):
    """구글 검색으로 다이닝코드 profile URL 찾기"""
    query = f"site:diningcode.com {restaurant_name} {address} 메뉴"
    encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={encoded}&hl=ko&num=5"

    print(f"  구글 검색: {query}")
    html = fetch(url)

    # diningcode profile URL 추출
    urls = re.findall(r'https?://(?:www\.)?diningcode\.com/profile\.php\?rid=[a-zA-Z0-9]+', html)
    urls = list(dict.fromkeys(urls))  # 중복 제거, 순서 유지

    print(f"  다이닝코드 URL: {len(urls)}개")
    for u in urls[:3]:
        print(f"    {u}")

    return urls


def scrape_diningcode_menu(url):
    """다이닝코드 상세 페이지에서 메뉴 수집"""
    print(f"  스크래핑: {url}")
    html = fetch(url)
    print(f"  응답: {len(html)} bytes")

    # ld+json 추출
    ld_matches = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)

    name = ""
    address = ""
    phone = ""
    menus = []

    for block in ld_matches:
        try:
            data = json.loads(block)
            if data.get("name"):
                name = data["name"]
            if data.get("telephone"):
                phone = data["telephone"]
            if data.get("address"):
                addr = data["address"]
                address = addr.get("streetAddress", "") if isinstance(addr, dict) else str(addr)

            if data.get("hasMenu") and data["hasMenu"].get("hasMenuItem"):
                for item in data["hasMenu"]["hasMenuItem"]:
                    menu_name = item.get("name", "")
                    price_raw = item.get("offers", {}).get("price", "")
                    price_str = re.sub(r'[^\d]', '', str(price_raw))
                    price = int(price_str) if price_str else 0

                    # 이름 정리
                    clean_name = re.sub(r'_[A-Za-z]+$', '', menu_name).strip()
                    clean_name = re.sub(r'\s*\([^)]*\)\s*$', '', clean_name).strip()

                    if clean_name and len(clean_name) >= 2 and price > 0:
                        menus.append({"name": clean_name, "price": price})
        except:
            pass

    return {"name": name, "address": address, "phone": phone, "menus": menus}


# 테스트 케이스
tests = [
    ("BBQ 제주한경점", "제주 제주시 한경면"),
    ("협재해수욕장횟집", "제주 제주시 한림읍"),
    ("올래국수", "제주"),
    ("한림분식", "제주 제주시 한림읍"),
]

print("=== 구글 검색 → 다이닝코드 메뉴 수집 테스트 ===\n")

for name, addr in tests:
    print(f"{'='*50}")
    print(f"식당: {name} ({addr})")
    print(f"{'='*50}")

    try:
        urls = google_search_diningcode(name, addr)

        if urls:
            result = scrape_diningcode_menu(urls[0])
            print(f"  결과: {result['name']} | {result['address']}")
            print(f"  메뉴: {len(result['menus'])}개")
            for m in result["menus"][:8]:
                print(f"    - {m['name']}: {m['price']:,}원")
        else:
            print(f"  다이닝코드 URL을 찾지 못함")
    except Exception as e:
        print(f"  오류: {e}")
    print()

print("=== 테스트 완료 ===")
