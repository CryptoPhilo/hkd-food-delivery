"""다이닝코드 스크래퍼 테스트 (ST-06, ST-07)"""

import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.diningcode_scraper import DiningcodeScraper

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures")


def load_fixture(name):
    with open(os.path.join(FIXTURES_DIR, name), encoding="utf-8") as f:
        return f.read()


class TestDiningcodeScraper:
    """ST-06, ST-07: 다이닝코드 스크래퍼 테스트"""

    @pytest.fixture
    def scraper(self):
        return DiningcodeScraper()

    # ST-06: ld+json 스키마 파싱
    def test_st06_parse_ld_json(self, scraper):
        """ST-06: ld+json 스키마에서 레스토랑 정보를 올바르게 파싱한다"""
        html = load_fixture("diningcode_detail.html")
        restaurant = scraper._parse_detail_page(html)

        assert restaurant is not None
        assert restaurant.name == "BBQ 제주한경점"
        assert restaurant.phone == "064-773-0669"
        assert "제주" in restaurant.address

    # ST-06 추가: 메뉴 파싱
    def test_st06_parse_menus_from_ld_json(self, scraper):
        """ST-06: ld+json에서 메뉴를 올바르게 추출한다"""
        html = load_fixture("diningcode_detail.html")
        restaurant = scraper._parse_detail_page(html)

        assert restaurant is not None
        assert len(restaurant.menus) >= 1  # 가격이 0인 '치킨무'는 제외됨

        menu_names = [m.name for m in restaurant.menus]
        assert "황금올리브치킨" in menu_names

        for menu in restaurant.menus:
            assert menu.price > 0, f"{menu.name}의 가격이 0입니다"

    # ST-06 추가: 이름 정리 (suffix 제거)
    def test_st06_menu_name_cleanup(self, scraper):
        """ST-06: 메뉴 이름에서 불필요한 suffix를 제거한다"""
        html = load_fixture("diningcode_detail.html")
        restaurant = scraper._parse_detail_page(html)

        for menu in restaurant.menus:
            assert not menu.name.endswith("_BBQ"), f"suffix 미제거: {menu.name}"

    # ST-07: 검색 결과 파싱
    def test_st07_parse_search_results_with_ld_json(self, scraper):
        """ST-07: ld+json ItemList에서 검색 결과를 파싱한다"""
        html = """
        <html>
        <script type="application/ld+json">
        {
            "@type": "ItemList",
            "itemListElement": [
                {"name": "식당A", "url": "https://www.diningcode.com/profile.dc?rid=abc"},
                {"name": "식당B", "url": "https://www.diningcode.com/profile.dc?rid=def"}
            ]
        }
        </script>
        </html>
        """
        results = scraper._parse_search_results(html)
        assert len(results) >= 2
        assert any(r["name"] == "식당A" for r in results)

    # ST-07 추가: profile 링크 직접 추출
    def test_st07_parse_profile_links(self, scraper):
        """ST-07: HTML에서 profile 링크를 직접 추출한다"""
        html = """
        <html>
        <a href="https://www.diningcode.com/profile.dc?rid=abc123">식당</a>
        <a href="https://www.diningcode.com/profile.dc?rid=def456">식당2</a>
        </html>
        """
        results = scraper._parse_search_results(html)
        urls = [r["url"] for r in results]
        assert "https://www.diningcode.com/profile.dc?rid=abc123" in urls
        assert "https://www.diningcode.com/profile.dc?rid=def456" in urls

    # ST-07 추가: 빈 HTML 처리
    def test_st07_empty_html(self, scraper):
        """ST-07: 빈 HTML에서 빈 결과를 반환한다"""
        results = scraper._parse_search_results("<html><body></body></html>")
        assert results == []

    # 에러 처리
    def test_scrape_detail_network_error(self, scraper):
        """네트워크 에러 시 None을 반환한다"""
        with patch.object(scraper.client, "get", side_effect=ConnectionError("timeout")):
            result = scraper.scrape_detail("https://example.com")

        assert result is None

    def test_extract_ld_json_static(self):
        """ld+json 추출 정적 메서드 테스트"""
        html = '<script type="application/ld+json">{"@type":"Restaurant"}</script>'
        blocks = DiningcodeScraper._extract_ld_json(html)
        assert len(blocks) == 1
        assert '"Restaurant"' in blocks[0]
