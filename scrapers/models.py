"""HKD 데이터 모델 - 플랫폼 간 통일된 데이터 구조"""

from dataclasses import asdict, dataclass, field
from typing import List


@dataclass
class Menu:
    """메뉴 아이템"""

    name: str
    price: int = 0
    description: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Restaurant:
    """레스토랑 정보"""

    name: str
    address: str = ""
    road_address: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    category: str = "기타"
    phone: str = ""
    description: str = ""
    is_active: bool = True
    is_deliverable: bool = True
    delivery_radius: int = 5
    rating: float = 0.0
    menus: List[Menu] = field(default_factory=list)
    source: str = ""  # 수집 플랫폼 (kakao, naver, diningcode)

    def to_api_dict(self) -> dict:
        """Admin API 전송용 딕셔너리"""
        return {
            "name": self.name,
            "address": self.address,
            "roadAddress": self.road_address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "category": self.category,
            "phone": self.phone,
            "description": self.description,
            "isActive": self.is_active,
            "isDeliverable": self.is_deliverable,
            "deliveryRadius": self.delivery_radius,
            "rating": self.rating,
            "menus": [m.to_dict() for m in self.menus],
        }

    def is_jeju(self) -> bool:
        """제주 지역 여부 확인"""
        return "제주" in self.address

    @staticmethod
    def categorize(category_name: str) -> str:
        """카카오 카테고리명을 단순 카테고리로 변환"""
        mappings = {
            "카페": ["카페", "커피"],
            "치킨": ["치킨"],
            "중식": ["중식", "중국"],
            "일식/횟집": ["일식", "초밥", "회"],
            "분식": ["분식", "떡볶이"],
            "양식/피자": ["피자", "양식", "패스트"],
            "고기/구이": ["고기", "삼겹", "갈비"],
            "한식": ["한식", "백반", "국밥"],
        }
        for cat, keywords in mappings.items():
            for kw in keywords:
                if kw in category_name:
                    return cat
        return "기타"
