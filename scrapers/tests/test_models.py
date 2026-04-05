"""데이터 모델 테스트 (ST-10)"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.models import Menu, Restaurant


class TestMenu:
    """Menu 모델 테스트"""

    def test_create_menu(self):
        menu = Menu(name="황금올리브치킨", price=19000)
        assert menu.name == "황금올리브치킨"
        assert menu.price == 19000
        assert menu.description == ""

    def test_to_dict(self):
        menu = Menu(name="양념치킨", price=18000, description="맛있는 양념치킨")
        d = menu.to_dict()
        assert d == {"name": "양념치킨", "price": 18000, "description": "맛있는 양념치킨"}

    def test_default_values(self):
        menu = Menu(name="테스트")
        assert menu.price == 0
        assert menu.description == ""


class TestRestaurant:
    """ST-10: Restaurant 모델 및 데이터 변환 테스트"""

    def test_create_restaurant(self):
        r = Restaurant(name="BBQ 제주한경점", address="제주시 한경면", phone="064-773-0669")
        assert r.name == "BBQ 제주한경점"
        assert r.is_active is True
        assert r.delivery_radius == 5

    def test_to_api_dict(self):
        """ST-10: API 전송용 딕셔너리 변환이 올바르다"""
        menus = [Menu(name="치킨", price=19000)]
        r = Restaurant(
            name="BBQ 제주한경점",
            address="제주시 한경면 고산리",
            road_address="제주시 한경면 일주서로 456",
            latitude=33.296,
            longitude=126.166,
            category="치킨",
            phone="064-773-0669",
            menus=menus,
        )
        d = r.to_api_dict()

        assert d["name"] == "BBQ 제주한경점"
        assert d["address"] == "제주시 한경면 고산리"
        assert d["roadAddress"] == "제주시 한경면 일주서로 456"
        assert d["latitude"] == 33.296
        assert d["longitude"] == 126.166
        assert d["isActive"] is True
        assert d["isDeliverable"] is True
        assert d["deliveryRadius"] == 5
        assert len(d["menus"]) == 1
        assert d["menus"][0]["name"] == "치킨"
        assert d["menus"][0]["price"] == 19000

    def test_is_jeju_true(self):
        r = Restaurant(name="테스트", address="제주특별자치도 제주시 한경면")
        assert r.is_jeju() is True

    def test_is_jeju_false(self):
        r = Restaurant(name="테스트", address="서울특별시 강남구")
        assert r.is_jeju() is False

    def test_categorize(self):
        """ST-10: 카테고리 분류가 올바르다"""
        test_cases = [
            ("음식점 > 치킨", "치킨"),
            ("음식점 > 카페 > 커피전문점", "카페"),
            ("음식점 > 한식 > 백반", "한식"),
            ("음식점 > 중식 > 중국집", "중식"),
            ("음식점 > 일식 > 초밥", "일식/횟집"),
            ("음식점 > 분식 > 떡볶이", "분식"),
            ("음식점 > 양식 > 피자", "양식/피자"),
            ("음식점 > 고기 > 삼겹살", "고기/구이"),
            ("음식점 > 베트남음식", "기타"),
        ]
        for category_name, expected in test_cases:
            assert Restaurant.categorize(category_name) == expected, (
                f"'{category_name}' → '{expected}' 예상했으나 '{Restaurant.categorize(category_name)}' 반환"
            )

    def test_empty_menus_by_default(self):
        r = Restaurant(name="테스트")
        assert r.menus == []
        assert r.to_api_dict()["menus"] == []

    def test_multiple_restaurants_independent_menus(self):
        """각 레스토랑의 메뉴 리스트가 독립적이다"""
        r1 = Restaurant(name="식당1")
        r2 = Restaurant(name="식당2")
        r1.menus.append(Menu(name="메뉴A", price=10000))

        assert len(r1.menus) == 1
        assert len(r2.menus) == 0
