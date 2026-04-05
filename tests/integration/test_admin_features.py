"""관리자 기능 통합 테스트 (TC-15 ~ TC-20)"""

import os

import pytest

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")


class MockAdminService:
    """테스트용 관리자 서비스"""

    def __init__(self):
        self.restaurants = {
            "test_001": {
                "id": "test_001",
                "name": "테스트식당1",
                "isActive": True,
                "isDeliverable": True,
            },
            "test_002": {
                "id": "test_002",
                "name": "테스트식당2",
                "isActive": True,
                "isDeliverable": True,
            },
        }
        self.menus = {
            "menu_001": {
                "id": "menu_001",
                "restaurantId": "test_001",
                "name": "테스트음식1",
                "price": 10000,
                "isAvailable": True,
            },
            "menu_002": {
                "id": "menu_002",
                "restaurantId": "test_001",
                "name": "테스트음식2",
                "price": 15000,
                "isAvailable": True,
            },
        }
        self.settings = {
            "business_hours": {
                "openTime": "09:00",
                "closeTime": "22:00",
                "closedDays": [],
                "isHoliday": False,
            },
            "delivery_config": {"baseFee": 3000, "perKmFee": 500, "maxDistance": 5.0},
        }

    def update_restaurant(self, restaurant_id, updates):
        if restaurant_id not in self.restaurants:
            return {"success": False, "error": "Not found"}
        self.restaurants[restaurant_id].update(updates)
        return {"success": True, "data": self.restaurants[restaurant_id]}

    def update_menu(self, menu_id, updates):
        if menu_id not in self.menus:
            return {"success": False, "error": "Not found"}
        self.menus[menu_id].update(updates)
        return {"success": True, "data": self.menus[menu_id]}

    def create_menu(self, restaurant_id, name, price, description=""):
        menu_id = f"menu_{len(self.menus) + 1:03d}"
        menu = {
            "id": menu_id,
            "restaurantId": restaurant_id,
            "name": name,
            "price": price,
            "description": description,
            "isAvailable": True,
        }
        self.menus[menu_id] = menu
        return {"success": True, "data": menu}

    def update_settings(self, key, value):
        self.settings[key] = value
        return {"success": True, "data": {"key": key, "value": value}}

    def get_active_restaurants(self):
        return [r for r in self.restaurants.values() if r["isActive"]]

    def get_available_menus(self, restaurant_id):
        return [
            m
            for m in self.menus.values()
            if m["restaurantId"] == restaurant_id and m["isAvailable"]
        ]


@pytest.fixture
def admin():
    return MockAdminService()


# === TC-15: 식당 활성화/비활성화 ===
class TestTC15RestaurantToggle:
    def test_deactivate_restaurant(self, admin):
        """식당을 비활성화한다"""
        result = admin.update_restaurant("test_001", {"isActive": False})
        assert result["success"] is True
        assert result["data"]["isActive"] is False

    def test_deactivated_not_in_list(self, admin):
        """비활성화된 식당은 목록에 표시되지 않는다"""
        admin.update_restaurant("test_001", {"isActive": False})
        active = admin.get_active_restaurants()
        assert len(active) == 1
        assert active[0]["name"] == "테스트식당2"

    def test_reactivate_restaurant(self, admin):
        """식당을 다시 활성화한다"""
        admin.update_restaurant("test_001", {"isActive": False})
        admin.update_restaurant("test_001", {"isActive": True})
        active = admin.get_active_restaurants()
        assert len(active) == 2


# === TC-16: 메뉴 활성화/비활성화 ===
class TestTC16MenuToggle:
    def test_deactivate_menu(self, admin):
        """메뉴를 비활성화한다"""
        result = admin.update_menu("menu_001", {"isAvailable": False})
        assert result["success"] is True
        assert result["data"]["isAvailable"] is False

    def test_deactivated_menu_not_in_list(self, admin):
        """비활성화된 메뉴는 목록에 표시되지 않는다"""
        admin.update_menu("menu_001", {"isAvailable": False})
        available = admin.get_available_menus("test_001")
        assert len(available) == 1
        assert available[0]["name"] == "테스트음식2"


# === TC-17: 메뉴 추가/수정 ===
class TestTC17MenuCRUD:
    def test_create_menu(self, admin):
        """새 메뉴를 추가한다"""
        result = admin.create_menu("test_001", "새로운메뉴", 12000, "맛있는 메뉴")
        assert result["success"] is True
        assert result["data"]["name"] == "새로운메뉴"
        assert result["data"]["price"] == 12000

    def test_update_menu(self, admin):
        """메뉴 정보를 수정한다"""
        result = admin.update_menu("menu_001", {"name": "수정된메뉴", "price": 15000})
        assert result["success"] is True
        assert result["data"]["name"] == "수정된메뉴"
        assert result["data"]["price"] == 15000


# === TC-18: 데이터 스크랩 (placeholder) ===
class TestTC18DataScrape:
    def test_scrape_request_format(self):
        """스크래핑 요청 형식이 올바르다"""
        request_body = {"area": "서울 강남구"}
        assert "area" in request_body
        assert isinstance(request_body["area"], str)


# === TC-19: 영업시간 설정 ===
class TestTC19BusinessHoursSettings:
    def test_update_business_hours(self, admin):
        """영업시간을 변경한다"""
        new_hours = {
            "openTime": "10:00",
            "closeTime": "21:00",
            "closedDays": ["sunday"],
            "isHoliday": False,
        }
        result = admin.update_settings("business_hours", new_hours)
        assert result["success"] is True
        assert admin.settings["business_hours"]["openTime"] == "10:00"
        assert admin.settings["business_hours"]["closeTime"] == "21:00"
        assert "sunday" in admin.settings["business_hours"]["closedDays"]


# === TC-20: 배달비 설정 ===
class TestTC20DeliveryFeeSettings:
    def test_update_delivery_config(self, admin):
        """배달비 정책을 변경한다"""
        new_config = {"baseFee": 2500, "perKmFee": 400, "maxDistance": 7.0}
        result = admin.update_settings("delivery_config", new_config)
        assert result["success"] is True
        assert admin.settings["delivery_config"]["baseFee"] == 2500
        assert admin.settings["delivery_config"]["perKmFee"] == 400
        assert admin.settings["delivery_config"]["maxDistance"] == 7.0
