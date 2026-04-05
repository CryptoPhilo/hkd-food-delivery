"""네이버 플레이스 기반 레스토랑/메뉴 수집"""

import json
import logging
import re
from typing import List, Optional
from urllib.parse import quote

from .http_client import HttpClient
from .models import Menu

logger = logging.getLogger(__name__)


class NaverScraper:
    """네이버 플레이스 API를 이용한 레스토랑 검색 및 메뉴 수집"""

    SEARCH_URLS = [
        "https://map.naver.com/p/api/search/allSearch?query={query}&type=all",
        "https://map.naver.com/v5/api/search?caller=pcweb&query={query}&type=all&page=1&displayCount=20",
    ]
    GRAPHQL_URL = "https://pcmap-api.place.naver.com/graphql"

    def __init__(self):
        self.client = HttpClient(
            timeout=15,
            max_retries=2,
            headers={
                "Referer": "https://map.naver.com/",
            },
        )

    def search(self, query: str) -> List[dict]:
        """네이버 지도 검색"""
        encoded = quote(query)
        for url_template in self.SEARCH_URLS:
            try:
                url = url_template.format(query=encoded)
                data = self.client.get_json(url)
                places = data.get("result", {}).get("place", {}).get("list", [])
                if places:
                    return places
            except Exception as e:
                logger.debug("네이버 검색 엔드포인트 실패: %s", e)
        return []

    def search_place_id(self, query: str) -> Optional[str]:
        """검색 결과에서 place ID 추출"""
        places = self.search(query)
        if places:
            return str(places[0].get("id", ""))

        # 대안: 네이버 통합검색에서 추출
        try:
            encoded = quote(query)
            html = self.client.get(
                f"https://search.naver.com/search.naver?query={encoded}&where=nexearch"
            )
            pids = re.findall(r"place/(\d+)", html)
            if pids:
                return pids[0]
        except Exception as e:
            logger.debug("네이버 통합검색 실패: %s", e)
        return None

    def scrape_menus(self, place_id: str) -> List[Menu]:
        """GraphQL API로 메뉴 수집"""
        menus = []
        gql_body = json.dumps(
            [
                {
                    "operationName": "getMenuItems",
                    "variables": {
                        "input": {
                            "businessId": place_id,
                            "isNx": False,
                            "display": 50,
                            "start": 1,
                        }
                    },
                    "query": (
                        "query getMenuItems($input: MenuItemsInput) { "
                        "menuItems(input: $input) { total items { name price description } } }"
                    ),
                }
            ]
        ).encode("utf-8")

        try:
            raw = self.client.get(
                self.GRAPHQL_URL,
                headers={
                    "Content-Type": "application/json",
                    "Referer": f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list",
                    "Origin": "https://pcmap.place.naver.com",
                },
            )
            # Note: GraphQL은 POST이지만, client.get에 data를 전달하는 구조이므로
            # 별도 처리가 필요하다면 post_json 사용
            result = json.loads(raw)
            items = result[0].get("data", {}).get("menuItems", {}).get("items", [])
            for item in items:
                name = item.get("name", "")
                price_str = re.sub(r"[^\d]", "", str(item.get("price", "0")))
                price = int(price_str) if price_str else 0
                if name:
                    menus.append(Menu(name=name, price=price))
        except Exception as e:
            logger.warning("네이버 메뉴 수집 실패 (place_id=%s): %s", place_id, e)

        # 대안: HTML 페이지에서 __NEXT_DATA__ 파싱
        if not menus:
            menus = self._scrape_menus_from_html(place_id)

        return menus

    def _scrape_menus_from_html(self, place_id: str) -> List[Menu]:
        """HTML 페이지에서 메뉴 추출 (폴백)"""
        menus = []
        try:
            html = self.client.get(f"https://pcmap.place.naver.com/restaurant/{place_id}/menu/list")
            nd_match = re.search(
                r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                html,
                re.DOTALL,
            )
            if nd_match:
                nd = json.loads(nd_match.group(1))
                dehy = nd.get("props", {}).get("pageProps", {}).get("dehydratedState", {})
                for q in dehy.get("queries", []):
                    qdata = q.get("state", {}).get("data", {})
                    if isinstance(qdata, dict) and "menuItems" in str(qdata):
                        items = qdata.get("menuItems", {}).get("items", [])
                        for item in items:
                            name = item.get("name", "")
                            price_str = re.sub(r"[^\d]", "", str(item.get("price", "0")))
                            price = int(price_str) if price_str else 0
                            if name:
                                menus.append(Menu(name=name, price=price))
        except Exception as e:
            logger.debug("네이버 HTML 메뉴 수집 실패: %s", e)
        return menus
