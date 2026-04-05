"""카카오맵 기반 레스토랑 데이터 수집"""

import json
import logging
import os
import re
from typing import List, Optional

from .http_client import HttpClient
from .models import Menu, Restaurant

logger = logging.getLogger(__name__)


class KakaoScraper:
    """카카오 REST API를 이용한 레스토랑 검색 및 메뉴 수집"""

    SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
    PLACE_URL = "https://place.map.kakao.com/main/v/{place_id}"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("KAKAO_REST_API_KEY", "")
        if not self.api_key:
            raise ValueError("KAKAO_REST_API_KEY가 설정되지 않았습니다.")
        self.client = HttpClient(timeout=10, max_retries=2)

    def search(self, query: str, page: int = 1, size: int = 15) -> List[dict]:
        """카카오 키워드 검색"""
        from urllib.parse import quote

        url = f"{self.SEARCH_URL}?query={quote(query)}&page={page}&size={size}"
        data = self.client.get_json(url, headers={"Authorization": f"KakaoAK {self.api_key}"})
        return data.get("documents", [])

    def search_restaurants(self, keywords: List[str], pages: int = 3) -> List[Restaurant]:
        """여러 키워드로 레스토랑 검색 (중복 제거)"""
        seen = {}
        for keyword in keywords:
            for page in range(1, pages + 1):
                try:
                    docs = self.search(keyword, page=page)
                    if not docs:
                        break
                    for doc in docs:
                        pid = doc.get("id", "")
                        if pid and pid not in seen:
                            cat_group = doc.get("category_group_code", "")
                            if cat_group not in ("FD6", "CE7", ""):
                                continue
                            addr = doc.get("address_name", "")
                            if "제주" not in addr:
                                continue
                            seen[pid] = doc
                    logger.info("  %s (페이지%d): %d개", keyword, page, len(docs))
                except Exception as e:
                    logger.warning("검색 실패: %s - %s", keyword, e)
                    break

        restaurants = []
        for pid, doc in seen.items():
            cat_name = doc.get("category_name", "")
            r = Restaurant(
                name=doc.get("place_name", ""),
                address=doc.get("address_name", ""),
                road_address=doc.get("road_address_name", ""),
                latitude=float(doc.get("y", 0)),
                longitude=float(doc.get("x", 0)),
                category=Restaurant.categorize(cat_name),
                phone=doc.get("phone", ""),
                description=cat_name,
                source="kakao",
            )
            restaurants.append(r)

        restaurants.sort(key=lambda x: x.name)
        return restaurants

    def scrape_menus(self, place_id: str) -> List[Menu]:
        """카카오맵 place 페이지에서 메뉴 수집"""
        menus = []
        try:
            url = self.PLACE_URL.format(place_id=place_id)
            raw = self.client.get(url, headers={"Accept": "application/json"})
            if raw.startswith("{"):
                data = json.loads(raw)
                menu_info = data.get("menuInfo", {})
                for item in menu_info.get("list", []):
                    name = item.get("menu", "") or item.get("name", "")
                    price_str = str(item.get("price", "0"))
                    price_str = re.sub(r"[^\d]", "", price_str)
                    price = int(price_str) if price_str else 0
                    if name:
                        menus.append(Menu(name=name, price=price))
        except Exception as e:
            logger.warning("메뉴 수집 실패 (place_id=%s): %s", place_id, e)
        return menus
