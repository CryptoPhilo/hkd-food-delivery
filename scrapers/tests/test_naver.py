"""네이버 스크래퍼 테스트 (ST-04, ST-05)"""

import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.naver_scraper import NaverScraper


class TestNaverScraper:
    """ST-04, ST-05: 네이버 플레이스 스크래퍼 테스트"""

    @pytest.fixture
    def scraper(self):
        return NaverScraper()

    # ST-04: 네이버 플레이스 검색 결과 파싱
    def test_st04_parse_search_results(self, scraper):
        """ST-04: 네이버 지도 검색 결과를 파싱한다"""
        mock_response = {
            "result": {
                "place": {
                    "list": [
                        {"id": "12345", "name": "BBQ 제주한경점", "address": "제주시 한경면"},
                        {"id": "67890", "name": "한경분식", "address": "제주시 한경면"},
                    ]
                }
            }
        }
        with patch.object(scraper.client, "get_json", return_value=mock_response):
            results = scraper.search("BBQ 제주한경점")

        assert len(results) == 2
        assert results[0]["name"] == "BBQ 제주한경점"
        assert results[0]["id"] == "12345"

    # ST-04 추가: 빈 검색 결과 처리
    def test_st04_empty_search_results(self, scraper):
        """ST-04: 검색 결과가 없을 때 빈 목록을 반환한다"""
        with patch.object(
            scraper.client, "get_json", return_value={"result": {"place": {"list": []}}}
        ):
            results = scraper.search("존재하지않는식당")

        assert results == []

    # ST-04 추가: 모든 엔드포인트 실패 시
    def test_st04_all_endpoints_fail(self, scraper):
        """ST-04: 모든 검색 엔드포인트 실패 시 빈 목록을 반환한다"""
        with patch.object(scraper.client, "get_json", side_effect=Exception("Error")):
            results = scraper.search("BBQ 제주한경점")

        assert results == []

    # ST-05: 메뉴 정보 추출 (HTML 파싱)
    def test_st05_scrape_menus_from_html(self, scraper):
        """ST-05: __NEXT_DATA__에서 메뉴를 추출한다"""
        mock_html = """
        <html>
        <script id="__NEXT_DATA__" type="application/json">
        {
            "props": {
                "pageProps": {
                    "dehydratedState": {
                        "queries": [{
                            "queryKey": "menuItems",
                            "state": {
                                "data": {
                                    "menuItems": {
                                        "items": [
                                            {"name": "황금올리브", "price": "19000"},
                                            {"name": "양념치킨", "price": "18000"}
                                        ]
                                    }
                                }
                            }
                        }]
                    }
                }
            }
        }
        </script>
        </html>
        """
        with patch.object(scraper.client, "get", return_value=mock_html):
            menus = scraper._scrape_menus_from_html("12345")

        assert len(menus) == 2
        assert menus[0].name == "황금올리브"
        assert menus[0].price == 19000

    # ST-05 추가: HTML에 메뉴가 없는 경우
    def test_st05_no_menus_in_html(self, scraper):
        """ST-05: HTML에 메뉴가 없을 때 빈 목록을 반환한다"""
        with patch.object(scraper.client, "get", return_value="<html><body>No data</body></html>"):
            menus = scraper._scrape_menus_from_html("12345")

        assert menus == []

    # place ID 추출 테스트
    def test_search_place_id(self, scraper):
        """검색 결과에서 place ID를 추출한다"""
        mock_response = {"result": {"place": {"list": [{"id": "99999", "name": "테스트식당"}]}}}
        with patch.object(scraper.client, "get_json", return_value=mock_response):
            pid = scraper.search_place_id("테스트식당")

        assert pid == "99999"

    def test_search_place_id_not_found(self, scraper):
        """검색 결과가 없을 때 None을 반환한다"""
        with patch.object(scraper.client, "get_json", side_effect=Exception("Error")):
            with patch.object(scraper.client, "get", side_effect=Exception("Error")):
                pid = scraper.search_place_id("존재하지않는식당")

        assert pid is None
