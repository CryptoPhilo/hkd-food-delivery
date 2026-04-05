"""전화번호 형식 검증 테스트 (VAL-01)"""

import re


# 전화번호 검증 함수 (프로덕션 코드에서 추출/구현 예정)
def validate_phone(phone: str) -> bool:
    """한국 휴대폰 번호 형식 검증 (010-XXXX-XXXX)"""
    if not phone:
        return False
    # 하이픈 제거 후 검증
    cleaned = phone.replace("-", "").replace(" ", "")
    pattern = r"^01[016789]\d{7,8}$"
    return bool(re.match(pattern, cleaned))


def format_phone(phone: str) -> str:
    """전화번호를 표준 형식으로 변환"""
    cleaned = phone.replace("-", "").replace(" ", "")
    if len(cleaned) == 11:
        return f"{cleaned[:3]}-{cleaned[3:7]}-{cleaned[7:]}"
    elif len(cleaned) == 10:
        return f"{cleaned[:3]}-{cleaned[3:6]}-{cleaned[6:]}"
    return phone


class TestPhoneValidation:
    """VAL-01: 전화번호 형식 검증"""

    # 유효한 번호들
    def test_valid_010_with_hyphens(self):
        assert validate_phone("010-1234-5678") is True

    def test_valid_010_without_hyphens(self):
        assert validate_phone("01012345678") is True

    def test_valid_010_with_spaces(self):
        assert validate_phone("010 1234 5678") is True

    def test_valid_011_old_format(self):
        assert validate_phone("011-123-4567") is True

    def test_valid_016_old_format(self):
        assert validate_phone("016-123-4567") is True

    # 무효한 번호들
    def test_invalid_empty(self):
        assert validate_phone("") is False

    def test_invalid_too_short(self):
        assert validate_phone("010-123") is False

    def test_invalid_too_long(self):
        assert validate_phone("010-12345-67890") is False

    def test_invalid_landline(self):
        assert validate_phone("02-1234-5678") is False

    def test_invalid_letters(self):
        assert validate_phone("010-abcd-efgh") is False

    def test_invalid_wrong_prefix(self):
        assert validate_phone("020-1234-5678") is False

    # 포맷 변환
    def test_format_11_digits(self):
        assert format_phone("01012345678") == "010-1234-5678"

    def test_format_10_digits(self):
        assert format_phone("0111234567") == "011-123-4567"

    def test_format_already_formatted(self):
        assert format_phone("010-1234-5678") == "010-1234-5678"
