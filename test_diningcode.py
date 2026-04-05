#!/usr/bin/env python3
"""다이닝코드 스크래핑 테스트"""

import urllib.request
import urllib.parse
import json
import re
import ssl
import certifi

# SSL 검증 (certifi 패키지로 macOS 인증서 이슈 해결)
ctx = ssl.create_default_context(cafile=certifi.where())

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")

def extract_ld_json(html):
    pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    return re.findall(pattern, html, re.DOTALL)

def test_search(query):
    print(f"\n{'='*60}")
    print(f"검색: {query}")
    print(f"{'='*60}")

    encoded = urllib.parse.quote(query)
    url = f"https://www.diningcode.com/list.dc?query={encoded}"
    print(f"URL: {url}")

    try:
        html = fetch(url)
        print(f"응답 크기: {len(html)} bytes")
    except Exception as e:
        print(f"요청 실패: {e}")
        return []

    # 봇 차단 체크
    if "captcha" in html.lower() or "robot" in html.lower():
        print("⚠ 봇 차단/CAPTCHA 감지!")
    if "__cf_bm" in html or "challenge-platform" in html:
        print("⚠ Cloudflare 보호 감지!")
    if len(html) < 5000:
        print(f"⚠ HTML이 매우 짧음 - 차단 가능성")

    # ld+json 추출
    ld_blocks = extract_ld_json(html)
    print(f"ld+json 블록: {len(ld_blocks)}개")

    restaurants = []
    for i, block in enumerate(ld_blocks):
        try:
            data = json.loads(block)
            dtype = data.get("@type", "?")
            print(f"  [{i}] @type: {dtype}")

            if dtype == "ItemList" and data.get("itemListElement"):
                items = data["itemListElement"]
                print(f"      식당 {len(items)}개:")
                for item in items[:5]:
                    print(f"        - {item.get('name')} → {item.get('url', '?')[:80]}")
                    restaurants.append(item)
        except Exception as e:
            print(f"  [{i}] 파싱 오류: {e}")

    # profile 링크 직접 찾기
    profile_links = list(set(re.findall(
        r'href="(https?://www\.diningcode\.com/profile\.dc\?rid=\d+)"', html
    )))
    print(f"profile 링크: {len(profile_links)}개")
    for link in profile_links[:3]:
        print(f"    {link}")

    return restaurants

def test_detail(url, name=""):
    print(f"\n{'='*60}")
    print(f"상세 페이지: {name}")
    print(f"URL: {url}")
    print(f"{'='*60}")

    try:
        html = fetch(url)
        print(f"응답 크기: {len(html)} bytes")
    except Exception as e:
        print(f"요청 실패: {e}")
        return

    ld_blocks = extract_ld_json(html)
    print(f"ld+json 블록: {len(ld_blocks)}개")

    for i, block in enumerate(ld_blocks):
        try:
            data = json.loads(block)
            dtype = data.get("@type", "?")

            if data.get("name"):
                print(f"  이름: {data['name']}")
            if data.get("address"):
                addr = data["address"]
                if isinstance(addr, dict):
                    print(f"  주소: {addr.get('streetAddress', '?')}")
                else:
                    print(f"  주소: {addr}")
            if data.get("telephone"):
                print(f"  전화: {data['telephone']}")

            if data.get("hasMenu") and data["hasMenu"].get("hasMenuItem"):
                menus = data["hasMenu"]["hasMenuItem"]
                print(f"  메뉴: {len(menus)}개")
                for mi in menus[:10]:
                    price = mi.get("offers", {}).get("price", "?")
                    print(f"    - {mi.get('name')}: {price}원")
            else:
                print(f"  메뉴: 없음 (hasMenu 키 없음)")
        except Exception as e:
            print(f"  [{i}] 파싱 오류: {e}")

    # hidden input으로 위경도 확인
    lat_match = re.search(r'id="hdn_lat"\s+type="hidden"\s+value="([^"]+)"', html)
    lng_match = re.search(r'id="hdn_lng"\s+type="hidden"\s+value="([^"]+)"', html)
    if lat_match:
        print(f"  위도: {lat_match.group(1)}")
    if lng_match:
        print(f"  경도: {lng_match.group(1)}")

# 테스트 실행
print("=== 다이닝코드 스크래핑 진단 ===")

# 테스트 1: BBQ 검색
items = test_search("BBQ 제주한경")

# 테스트 2: 한경면 맛집
items2 = test_search("한경면 맛집")

# 테스트 3: 상세 페이지 (첫 번째 결과가 있으면)
all_items = items + items2
if all_items:
    first = all_items[0]
    test_detail(first.get("url", ""), first.get("name", ""))
else:
    # 직접 프로필 URL 테스트
    print("\n검색 결과가 없어 직접 프로필 테스트...")
    test_detail("https://www.diningcode.com/profile.dc?rid=b0OoYDzMXR3j", "테스트")

print("\n=== 진단 완료 ===")
