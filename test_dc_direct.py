#!/usr/bin/env python3
"""다이닝코드 상세 페이지 URL 직접 접근 → 메뉴 수집 테스트"""

import urllib.request
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

url = "https://www.diningcode.com/profile.php?rid=1PeAN7IzZp12"
print(f"URL: {url}\n")

req = urllib.request.Request(url, headers=HEADERS)
with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    html = resp.read().decode("utf-8", errors="replace")

print(f"응답: {len(html)} bytes\n")

# ld+json 추출
ld_matches = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"ld+json 블록: {len(ld_matches)}개\n")

for block in ld_matches:
    try:
        data = json.loads(block)
        if data.get("name"):
            print(f"식당명: {data['name']}")
        if data.get("telephone"):
            print(f"전화: {data['telephone']}")
        if data.get("address"):
            addr = data["address"]
            if isinstance(addr, dict):
                print(f"주소: {addr.get('streetAddress', '')}")
            else:
                print(f"주소: {addr}")

        if data.get("hasMenu") and data["hasMenu"].get("hasMenuItem"):
            items = data["hasMenu"]["hasMenuItem"]
            print(f"\n메뉴: {len(items)}개")
            print("-" * 40)
            for item in items:
                name = item.get("name", "")
                price_raw = item.get("offers", {}).get("price", "")
                price_str = re.sub(r'[^\d]', '', str(price_raw))
                price = int(price_str) if price_str else 0

                clean_name = re.sub(r'_[A-Za-z]+$', '', name).strip()
                clean_name = re.sub(r'\s*\([^)]*\)\s*$', '', clean_name).strip()

                if clean_name and len(clean_name) >= 2:
                    print(f"  {clean_name:20s} {price:>8,}원" if price else f"  {clean_name:20s}     가격없음")
    except Exception as e:
        print(f"파싱 오류: {e}")

print("\n=== 완료 ===")
