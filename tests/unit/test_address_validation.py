"""주소 유효성 검증 테스트 (VAL-02)"""


def validate_jeju_address(address: str) -> bool:
    """제주 지역 주소 검증"""
    if not address or not isinstance(address, str):
        return False
    return "제주" in address


def validate_delivery_address(address: str) -> dict:
    """배달 주소 유효성 검증"""
    errors = []
    if not address:
        errors.append("주소가 비어있습니다")
    elif len(address) < 5:
        errors.append("주소가 너무 짧습니다")
    elif len(address) > 200:
        errors.append("주소가 너무 깁니다")

    return {"valid": len(errors) == 0, "errors": errors}


class TestAddressValidation:
    """VAL-02: 주소 유효성 검증"""

    # 제주 지역 검증
    def test_jeju_address_valid(self):
        assert validate_jeju_address("제주특별자치도 제주시 한경면 고산리 123") is True

    def test_jeju_address_short(self):
        assert validate_jeju_address("제주시 한림읍") is True

    def test_non_jeju_address(self):
        assert validate_jeju_address("서울특별시 강남구 역삼동") is False

    def test_empty_address(self):
        assert validate_jeju_address("") is False

    def test_none_address(self):
        assert validate_jeju_address(None) is False

    # 배달 주소 검증
    def test_valid_delivery_address(self):
        result = validate_delivery_address("제주시 한경면 고산리 일주서로 123")
        assert result["valid"] is True
        assert result["errors"] == []

    def test_empty_delivery_address(self):
        result = validate_delivery_address("")
        assert result["valid"] is False
        assert "비어있습니다" in result["errors"][0]

    def test_short_delivery_address(self):
        result = validate_delivery_address("제주")
        assert result["valid"] is False
        assert "짧습니다" in result["errors"][0]

    def test_long_delivery_address(self):
        result = validate_delivery_address("가" * 201)
        assert result["valid"] is False
        assert "깁니다" in result["errors"][0]
