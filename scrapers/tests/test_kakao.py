"""카카오 스크래퍼 테스트 (ST-01, ST-02, ST-03)"""

import json
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.kakao_scraper import KakaoScraper
from scrapers.models import Restaurant

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures")


def load_fixture(name):
    with open(os.path.join(FIXTURES_DIR, name), encoding="utf-8") as f:
        return f.read()


class TestKakaoScraper:
    """ST-01 ~ ST-03: 카카오 스크래퍼 테스트"""

    @pytest.fixture
    def scraper(self):
        """테스트용 스크래퍼 (API 키 모킹)"""
        with patch.dict(os.environ, {"KAKAO_REST_API_KEY": "test_key"}):
            return KakaoScraper(api_key="test_key")

    @pytest.fixture
    def mock_search_response(self):
        return json.loads(load_fixture("kakao_search_response.json"))

    # ST-01: 카카오 API 응답 파싱 정상 동작
    def test_st01_parse_search_response(self, scraper, mock_search_response):
        """ST-01: 카카오 API 응답을 올바르게 파싱한다"""
        with patch.object(scraper.client, "get_json", return_value=mock_search_response):
            results = scraper.search("한경면 음식점")

        assert len(results) == 3
        assert results[0]["place_name"] == "BBQ 제주한경점"
        assert results[0]["category_group_code"] == "FD6"
        assert results[0]["phone"] == "064-773-0669"

    # ST-02: 제주 외 지역 필터링 동작
    def test_st02_filter_non_jeju(self, scraper, mock_search_response):
        """ST-02: 제주 외 지역의 레스토랑을 필터링한다"""
        with patch.object(scraper.client, "get_json", return_value=mock_search_response):
            restaurants = scraper.search_restaurants(["한경면 음식점"], pages=1)

        # 서울식당(id=11111)은 필터링되어야 함
        names = [r.name for r in restaurants]
        assert "서울식당" not in names
        assert "BBQ 제주한경점" in names
        assert "한경분식" in names
        assert len(restaurants) == 2

    # ST-02 추가: 모든 레스토랑이 제주 지역인지 확인
    def test_st02_all_results_are_jeju(self, scraper, mock_search_response):
        """ST-02: 반환된 모든 레스토랑이 제주 지역이다"""
        with patch.object(scraper.client, "get_json", return_value=mock_search_response):
            restaurants = scraper.search_restaurants(["한경면 음식점"], pages=1)

        for r in restaurants:
            assert r.is_jeju(), f"{r.name}의 주소에 '제주'가 없습니다: {r.address}"

    # ST-03: API 에러 시 예외 처리
    def test_st03_api_error_handling(self, scraper):
        """ST-03: API 에러 발생 시 빈 목록을 반환한다"""
        with patch.object(scraper.client, "get_json", side_effect=ConnectionError("API Error")):
            restaurants = scraper.search_restaurants(["한경면 음식점"], pages=1)

        assert restaurants == []

    # ST-03 추가: 빈 응답 처리
    def test_st03_empty_response(self, scraper):
        """ST-03: 빈 응답 시 빈 목록을 반환한다"""
        with patch.object(scraper.client, "get_json", return_value={"documents": [], "meta": {}}):
            results = scraper.search("존재하지않는검색어")

        assert results == []

    # 카테고리 분류 테스트
    def test_categorize_chicken(self):
        assert Restaurant.categorize("음식점 > 치킨") == "치킨"

    def test_categorize_cafe(self):
        assert Restaurant.categorize("음식점 > 카페") == "카페"

    def test_categorize_korean(self):
        assert Restaurant.categorize("음식점 > 한식 > 국밥") == "한식"

    def test_categorize_unknown(self):
        assert Restaurant.categorize("음식점 > 기타요리") == "기타"


class TestKakaoMenuScraping:
    """카카오맵 메뉴 수집 테스트"""

    @pytest.fixture
    def scraper(self):
        with patch.dict(os.environ, {"KAKAO_REST_API_KEY": "test_key"}):
            return KakaoScraper(api_key="test_key")

    def test_scrape_menus_from_api(self, scraper):
        """place API에서 메뉴를 수집한다"""
        mock_data = json.loads(load_fixture("kakao_place_detail.json"))
        with patch.object(scraper.client, "get", return_value=json.dumps(mock_data)):
            menus = scraper.scrape_menus("12345")

        assert len(menus) == 3
        assert menus[0].name == "황금올리브치킨"
        assert menus[0].price == 19000

    def test_scrape_menus_error_returns_empty(self, scraper):
        """메뉴 수집 실패 시 빈 목록을 반환한다"""
        with patch.object(scraper.client, "get", side_effect=Exception("Network Error")):
            menus = scraper.scrape_menus("99999")

        assert menus == []
