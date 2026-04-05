"""거리 제한 검증 테스트 (VAL-04)"""

import math

import pytest

DEFAULT_MAX_DISTANCE = 5.0  # km
DEFAULT_BASE_FEE = 3000
DEFAULT_PER_KM_FEE = 500


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리 계산 (Haversine 공식, km)"""
    R = 6371  # 지구 반지름 (km)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def calculate_delivery_fee(
    distance: float,
    base_fee: int = DEFAULT_BASE_FEE,
    per_km_fee: int = DEFAULT_PER_KM_FEE,
    max_distance: float = DEFAULT_MAX_DISTANCE,
) -> dict:
    """배달비 계산"""
    if distance < 0:
        return {"deliverable": False, "fee": 0, "error": "유효하지 않은 거리"}
    if distance > max_distance:
        return {"deliverable": False, "fee": 0, "error": f"배달 가능 거리({max_distance}km) 초과"}

    if distance <= 2.0:
        fee = base_fee
    else:
        fee = base_fee + int((distance - 2.0) * per_km_fee)

    return {"deliverable": True, "fee": fee, "distance": round(distance, 2)}


class TestHaversineDistance:
    """VAL-04: Haversine 거리 계산"""

    def test_same_point(self):
        """같은 좌표의 거리는 0이다"""
        d = haversine_distance(33.296, 126.166, 33.296, 126.166)
        assert d == pytest.approx(0.0, abs=0.001)

    def test_gangnam_to_nonhyeon(self):
        """강남역 → 논현역 거리 (약 1.5km)"""
        d = haversine_distance(37.497942, 127.027621, 37.5117, 127.0200)
        assert 1.0 < d < 2.5

    def test_jeju_hangyeong_to_hallim(self):
        """한경면 → 한림읍 거리 (약 5-10km)"""
        d = haversine_distance(33.296, 126.166, 33.407, 126.265)
        assert 5.0 < d < 20.0

    def test_negative_coordinates(self):
        """음수 좌표도 계산 가능하다"""
        d = haversine_distance(-33.8688, 151.2093, -37.8136, 144.9631)
        assert d > 0


class TestDeliveryFee:
    """VAL-04: 배달비 계산 및 거리 제한"""

    def test_within_2km_base_fee(self):
        """2km 이내: 기본 배달비"""
        result = calculate_delivery_fee(1.5)
        assert result["deliverable"] is True
        assert result["fee"] == 3000

    def test_at_2km_base_fee(self):
        """정확히 2km: 기본 배달비"""
        result = calculate_delivery_fee(2.0)
        assert result["deliverable"] is True
        assert result["fee"] == 3000

    def test_over_2km_extra_fee(self):
        """2km 초과: 추가 배달비"""
        result = calculate_delivery_fee(3.0)
        assert result["deliverable"] is True
        assert result["fee"] == 3500  # 3000 + 500 * 1

    def test_at_max_distance(self):
        """최대 거리: 배달 가능"""
        result = calculate_delivery_fee(5.0)
        assert result["deliverable"] is True
        assert result["fee"] == 4500  # 3000 + 500 * 3

    def test_over_max_distance(self):
        """최대 거리 초과: 배달 불가"""
        result = calculate_delivery_fee(5.1)
        assert result["deliverable"] is False
        assert "초과" in result["error"]

    def test_zero_distance(self):
        """거리 0: 기본 배달비"""
        result = calculate_delivery_fee(0)
        assert result["deliverable"] is True
        assert result["fee"] == 3000

    def test_negative_distance(self):
        """음수 거리: 유효하지 않음"""
        result = calculate_delivery_fee(-1.0)
        assert result["deliverable"] is False

    def test_custom_config(self):
        """커스텀 배달비 설정"""
        result = calculate_delivery_fee(3.0, base_fee=2500, per_km_fee=400, max_distance=7.0)
        assert result["deliverable"] is True
        assert result["fee"] == 2900  # 2500 + 400 * 1

    def test_integration_with_haversine(self):
        """Haversine + 배달비 계산 통합"""
        # 강남역 → 논현역 (약 1.5km)
        distance = haversine_distance(37.497942, 127.027621, 37.5117, 127.0200)
        result = calculate_delivery_fee(distance)
        assert result["deliverable"] is True
        assert result["fee"] == 3000  # 2km 이내이므로 기본 배달비
