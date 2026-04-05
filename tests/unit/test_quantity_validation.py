"""수량/금액 범위 검증 테스트 (VAL-03)"""

MAX_QUANTITY = 99
MAX_PRICE = 1_000_000  # 100만원
MIN_ORDER_AMOUNT = 5_000  # 최소 주문금액


def validate_quantity(quantity) -> dict:
    """주문 수량 검증"""
    errors = []
    if not isinstance(quantity, (int, float)):
        errors.append("수량은 숫자여야 합니다")
    elif quantity <= 0:
        errors.append("수량은 1 이상이어야 합니다")
    elif quantity > MAX_QUANTITY:
        errors.append(f"수량은 {MAX_QUANTITY}개를 초과할 수 없습니다")
    elif not float(quantity).is_integer():
        errors.append("수량은 정수여야 합니다")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_price(price) -> dict:
    """가격 검증"""
    errors = []
    if not isinstance(price, (int, float)):
        errors.append("가격은 숫자여야 합니다")
    elif price < 0:
        errors.append("가격은 0 이상이어야 합니다")
    elif price > MAX_PRICE:
        errors.append(f"가격은 {MAX_PRICE:,}원을 초과할 수 없습니다")

    return {"valid": len(errors) == 0, "errors": errors}


def validate_order_total(items: list) -> dict:
    """주문 합계 검증"""
    total = sum(item.get("price", 0) * item.get("quantity", 0) for item in items)
    errors = []
    if total < MIN_ORDER_AMOUNT:
        errors.append(f"최소 주문금액은 {MIN_ORDER_AMOUNT:,}원입니다 (현재: {total:,}원)")
    return {"valid": len(errors) == 0, "total": total, "errors": errors}


class TestQuantityValidation:
    """VAL-03: 수량 범위 검증"""

    def test_valid_quantity(self):
        assert validate_quantity(1)["valid"] is True
        assert validate_quantity(50)["valid"] is True
        assert validate_quantity(99)["valid"] is True

    def test_zero_quantity(self):
        result = validate_quantity(0)
        assert result["valid"] is False
        assert "1 이상" in result["errors"][0]

    def test_negative_quantity(self):
        result = validate_quantity(-1)
        assert result["valid"] is False

    def test_over_max_quantity(self):
        result = validate_quantity(100)
        assert result["valid"] is False
        assert "초과" in result["errors"][0]

    def test_float_quantity(self):
        result = validate_quantity(1.5)
        assert result["valid"] is False
        assert "정수" in result["errors"][0]

    def test_string_quantity(self):
        result = validate_quantity("abc")
        assert result["valid"] is False


class TestPriceValidation:
    """VAL-03: 금액 범위 검증"""

    def test_valid_price(self):
        assert validate_price(10000)["valid"] is True
        assert validate_price(0)["valid"] is True

    def test_negative_price(self):
        result = validate_price(-1000)
        assert result["valid"] is False

    def test_over_max_price(self):
        result = validate_price(1_000_001)
        assert result["valid"] is False

    def test_string_price(self):
        result = validate_price("만원")
        assert result["valid"] is False


class TestOrderTotalValidation:
    """VAL-03: 주문 합계 검증"""

    def test_valid_order_total(self):
        items = [{"price": 10000, "quantity": 2}]
        result = validate_order_total(items)
        assert result["valid"] is True
        assert result["total"] == 20000

    def test_below_minimum(self):
        items = [{"price": 2000, "quantity": 1}]
        result = validate_order_total(items)
        assert result["valid"] is False
        assert "최소" in result["errors"][0]

    def test_empty_order(self):
        result = validate_order_total([])
        assert result["valid"] is False
        assert result["total"] == 0

    def test_multiple_items(self):
        items = [
            {"price": 3000, "quantity": 1},
            {"price": 2500, "quantity": 2},
        ]
        result = validate_order_total(items)
        assert result["valid"] is True
        assert result["total"] == 8000
