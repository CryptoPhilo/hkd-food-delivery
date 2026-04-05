"""다이닝코드 기반 레스토랑/메뉴 수집"""

import json
import logging
import re
from typing import List, Optional
from urllib.parse import quote

from .http_client import HttpClient
from .models import Menu, Restaurant

logger = logging.getLogger(__name__)


class DiningcodeScraper:
    """다이닝코드 웹 스크래핑을 이용한 레스토랑/메뉴 수집"""

    SEARCH_URL = "https://www.diningcode.com/list.dc?query={query}"
    BASE_URL = "https://www.diningcode.com"

    def __init__(self):
        self.client = HttpClient(
            timeout=15,
            max_retries=2,
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )

    def search(self, query: str) -> List[dict]:
        """다이닝코드 검색"""
        url = self.SEARCH_URL.format(query=quote(query))
        try:
            html = self.client.get(url)
            return self._parse_search_results(html)
        except Exception as e:
            logger.warning("다이닝코드 검색 실패: %s", e)
            return []

    def scrape_detail(self, url: str) -> Optional[Restaurant]:
        """상세 페이지에서 레스토랑 정보 및 메뉴 수집"""
        try:
            html = self.client.get(url)
            return self._parse_detail_page(html)
        except Exception as e:
            logger.warning("다이닝코드 상세 페이지 실패 (%s): %s", url[:60], e)
            return None

    def scrape_menus(self, url: str) -> List[Menu]:
        """상세 페이지에서 메뉴만 수집"""
        restaurant = self.scrape_detail(url)
        return restaurant.menus if restaurant else []

    def _parse_search_results(self, html: str) -> List[dict]:
        """검색 결과 HTML에서 레스토랑 목록 추출 (ld+json)"""
        results = []
        ld_blocks = self._extract_ld_json(html)

        for block_text in ld_blocks:
            try:
                data = json.loads(block_text)
                if data.get("@type") == "ItemList" and data.get("itemListElement"):
                    for item in data["itemListElement"]:
                        results.append(
                            {
                                "name": item.get("name", ""),
                                "url": item.get("url", ""),
                            }
                        )
            except (json.JSONDecodeError, KeyError):
                pass

        # profile 링크 직접 추출
        profile_links = list(
            set(re.findall(r'href="(https?://www\.diningcode\.com/profile\.dc\?rid=\w+)"', html))
        )
        for link in profile_links:
            if not any(r["url"] == link for r in results):
                results.append({"name": "", "url": link})

        return results

    def _parse_detail_page(self, html: str) -> Optional[Restaurant]:
        """상세 페이지 HTML에서 레스토랑 정보 추출"""
        ld_blocks = self._extract_ld_json(html)

        name = ""
        address = ""
        phone = ""
        menus = []

        for block_text in ld_blocks:
            try:
                data = json.loads(block_text)
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
                        price_str = re.sub(r"[^\d]", "", str(price_raw))
                        price = int(price_str) if price_str else 0

                        # 이름 정리
                        clean_name = re.sub(r"_[A-Za-z]+$", "", menu_name).strip()
                        clean_name = re.sub(r"\s*\([^)]*\)\s*$", "", clean_name).strip()

                        if clean_name and len(clean_name) >= 2 and price > 0:
                            menus.append(Menu(name=clean_name, price=price))
            except (json.JSONDecodeError, KeyError):
                pass

        if not name:
            return None

        return Restaurant(
            name=name,
            address=address,
            phone=phone,
            menus=menus,
            source="diningcode",
        )

    @staticmethod
    def _extract_ld_json(html: str) -> List[str]:
        """HTML에서 ld+json 블록 추출"""
        pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
        return re.findall(pattern, html, re.DOTALL)
