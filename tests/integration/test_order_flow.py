"""주문 플로우 통합 테스트 (TC-07 ~ TC-14)

주문 생성 → 픽업시간 설정 → 확정/취소 → 픽업 → 배달 → 완료의 전체 플로우를 테스트합니다.
"""

import os
import uuid
from datetime import datetime

import pytest

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")


class MockOrderService:
    """테스트용 주문 서비스"""

    def __init__(self):
        self.orders = {}
        self.sms_log = []

    def create_order(self, restaurant_id, items, delivery_address, lat, lng):
        """TC-07: 주문 생성"""
        order_id = str(uuid.uuid4())[:8]
        order_number = datetime.now().strftime("%Y%m%d") + order_id.upper()
        order = {
            "id": order_id,
            "order_number": order_number,
            "restaurant_id": restaurant_id,
            "items": items,
            "delivery_address": delivery_address,
            "delivery_lat": lat,
            "delivery_lng": lng,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "confirm_token": None,
            "confirmed_at": None,
            "cancelled_at": None,
            "cancel_reason": None,
            "pickup_time": None,
            "estimated_pickup_time": None,
            "restaurant_paid_amount": None,
            "delivered_at": None,
        }
        self.orders[order_id] = order
        self.sms_log.append(f"주문이 요청되었습니다. 주문번호: {order_number}")
        return {"success": True, "data": order}

    def set_pickup_time(self, order_id, pickup_time, memo=""):
        """TC-09: 픽업 시간 설정"""
        order = self.orders.get(order_id)
        if not order:
            return {"success": False, "error": "Order not found"}
        if order["status"] != "pending":
            return {"success": False, "error": "Invalid status"}

        token = str(uuid.uuid4())[:16]
        order["status"] = "pending_confirmation"
        order["estimated_pickup_time"] = pickup_time
        order["confirm_token"] = token
        order["restaurant_memo"] = memo
        self.sms_log.append(f"픽업시간 {pickup_time}, 확인 링크 포함 SMS 발송")
        return {"success": True, "data": order}

    def confirm_order(self, token):
        """TC-10: 주문 확정"""
        for order in self.orders.values():
            if order["confirm_token"] == token:
                order["status"] = "order_confirmed"
                order["confirmed_at"] = datetime.now().isoformat()
                order["confirm_token"] = None
                self.sms_log.append("주문이 확정되었습니다")
                return {"success": True, "data": order}
        return {"success": False, "error": "Invalid token"}

    def cancel_order(self, token):
        """TC-11: 주문 취소"""
        for order in self.orders.values():
            if order["confirm_token"] == token:
                order["status"] = "cancelled"
                order["cancelled_at"] = datetime.now().isoformat()
                order["cancel_reason"] = "Customer cancelled during confirmation"
                order["confirm_token"] = None
                self.sms_log.append("주문이 취소되었습니다")
                return {"success": True, "data": order}
        return {"success": False, "error": "Invalid token"}

    def pickup_complete(self, order_id, paid_amount):
        """TC-12: 픽업 완료"""
        order = self.orders.get(order_id)
        if not order or order["status"] != "order_confirmed":
            return {"success": False, "error": "Invalid status"}
        order["status"] = "picked_up"
        order["restaurant_paid_amount"] = paid_amount
        order["pickup_time"] = datetime.now().isoformat()
        self.sms_log.append("음식이 픽업되었습니다")
        return {"success": True, "data": order}

    def start_delivery(self, order_id):
        """TC-13: 배달 시작"""
        order = self.orders.get(order_id)
        if not order or order["status"] != "picked_up":
            return {"success": False, "error": "Invalid status"}
        order["status"] = "delivering"
        self.sms_log.append("배달 중입니다")
        return {"success": True, "data": order}

    def complete_delivery(self, order_id):
        """TC-14: 배달 완료"""
        order = self.orders.get(order_id)
        if not order or order["status"] != "delivering":
            return {"success": False, "error": "Invalid status"}
        order["status"] = "completed"
        order["delivered_at"] = datetime.now().isoformat()
        self.sms_log.append("배달이 완료되었습니다")
        return {"success": True, "data": order}


@pytest.fixture
def service():
    return MockOrderService()


# === TC-07: 주문 생성 ===
class TestTC07OrderCreate:
    def test_create_order(self, service):
        """주문이 성공적으로 생성된다"""
        result = service.create_order(
            "test_001",
            [{"menuId": "menu_001", "quantity": 2}],
            "서울 강남구 테헤란로 100",
            37.5117,
            127.0200,
        )
        assert result["success"] is True
        assert result["data"]["status"] == "pending"
        assert result["data"]["order_number"] is not None

    def test_order_number_format(self, service):
        """주문번호가 YYYYMMDD + ID 형식이다"""
        result = service.create_order("test_001", [], "주소", 37.5, 127.0)
        order_number = result["data"]["order_number"]
        assert len(order_number) >= 16
        assert order_number[:4].isdigit()  # 연도

    def test_sms_sent_on_creation(self, service):
        """주문 생성 시 SMS가 발송된다"""
        service.create_order("test_001", [], "주소", 37.5, 127.0)
        assert any("요청되었습니다" in msg for msg in service.sms_log)


# === TC-08: 관리자 주문 목록 (placeholder) ===
class TestTC08AdminOrderList:
    def test_list_pending_orders(self, service):
        """pending 상태 주문을 조회한다"""
        service.create_order("test_001", [], "주소1", 37.5, 127.0)
        service.create_order("test_002", [], "주소2", 37.5, 127.0)
        pending = [o for o in service.orders.values() if o["status"] == "pending"]
        assert len(pending) == 2


# === TC-09: 픽업 시간 설정 ===
class TestTC09PickupTime:
    def test_set_pickup_time(self, service):
        """픽업 시간이 설정되고 confirm_token이 생성된다"""
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        order_id = order["data"]["id"]

        result = service.set_pickup_time(order_id, "2026-04-04T14:30:00Z")
        assert result["success"] is True
        assert result["data"]["status"] == "pending_confirmation"
        assert result["data"]["confirm_token"] is not None
        assert result["data"]["estimated_pickup_time"] == "2026-04-04T14:30:00Z"

    def test_sms_includes_confirm_link(self, service):
        """SMS에 확인 링크가 포함된다"""
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        assert any("확인 링크" in msg for msg in service.sms_log)


# === TC-10: 주문 확정 ===
class TestTC10OrderConfirm:
    def test_confirm_with_valid_token(self, service):
        """유효한 토큰으로 주문을 확정한다"""
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        pt_result = service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        token = pt_result["data"]["confirm_token"]

        result = service.confirm_order(token)
        assert result["success"] is True
        assert result["data"]["status"] == "order_confirmed"
        assert result["data"]["confirmed_at"] is not None
        assert result["data"]["confirm_token"] is None  # 토큰 소멸

    def test_confirm_with_invalid_token(self, service):
        """유효하지 않은 토큰으로 확정 실패"""
        result = service.confirm_order("invalid_token")
        assert result["success"] is False


# === TC-11: 주문 취소 ===
class TestTC11OrderCancel:
    def test_cancel_with_valid_token(self, service):
        """유효한 토큰으로 주문을 취소한다"""
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        pt_result = service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        token = pt_result["data"]["confirm_token"]

        result = service.cancel_order(token)
        assert result["success"] is True
        assert result["data"]["status"] == "cancelled"
        assert result["data"]["cancelled_at"] is not None
        assert result["data"]["cancel_reason"] is not None


# === TC-12: 픽업 완료 ===
class TestTC12PickupComplete:
    def _setup_confirmed_order(self, service):
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        pt = service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        service.confirm_order(pt["data"]["confirm_token"])
        return order["data"]["id"]

    def test_pickup_complete(self, service):
        """픽업 완료 처리"""
        order_id = self._setup_confirmed_order(service)
        result = service.pickup_complete(order_id, 20000)
        assert result["success"] is True
        assert result["data"]["status"] == "picked_up"
        assert result["data"]["restaurant_paid_amount"] == 20000
        assert result["data"]["pickup_time"] is not None

    def test_pickup_invalid_status(self, service):
        """pending 상태에서 픽업 불가"""
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        result = service.pickup_complete(order["data"]["id"], 20000)
        assert result["success"] is False


# === TC-13: 배달 시작 ===
class TestTC13DeliveryStart:
    def _setup_picked_up_order(self, service):
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        pt = service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        service.confirm_order(pt["data"]["confirm_token"])
        service.pickup_complete(order["data"]["id"], 20000)
        return order["data"]["id"]

    def test_start_delivery(self, service):
        """배달 시작 처리"""
        order_id = self._setup_picked_up_order(service)
        result = service.start_delivery(order_id)
        assert result["success"] is True
        assert result["data"]["status"] == "delivering"


# === TC-14: 배달 완료 ===
class TestTC14DeliveryComplete:
    def _setup_delivering_order(self, service):
        order = service.create_order("test_001", [], "주소", 37.5, 127.0)
        pt = service.set_pickup_time(order["data"]["id"], "2026-04-04T14:30:00Z")
        service.confirm_order(pt["data"]["confirm_token"])
        service.pickup_complete(order["data"]["id"], 20000)
        service.start_delivery(order["data"]["id"])
        return order["data"]["id"]

    def test_complete_delivery(self, service):
        """배달 완료 처리"""
        order_id = self._setup_delivering_order(service)
        result = service.complete_delivery(order_id)
        assert result["success"] is True
        assert result["data"]["status"] == "completed"
        assert result["data"]["delivered_at"] is not None

    def test_full_order_lifecycle(self, service):
        """전체 주문 생명주기: pending → confirmed → picked_up → delivering → completed"""
        # 1. 주문 생성
        order = service.create_order(
            "test_001", [{"menuId": "m1", "quantity": 1}], "주소", 37.5, 127.0
        )
        assert order["data"]["status"] == "pending"

        # 2. 픽업 시간 설정
        oid = order["data"]["id"]
        pt = service.set_pickup_time(oid, "2026-04-04T14:30:00Z")
        assert pt["data"]["status"] == "pending_confirmation"

        # 3. 주문 확정
        confirm = service.confirm_order(pt["data"]["confirm_token"])
        assert confirm["data"]["status"] == "order_confirmed"

        # 4. 픽업 완료
        pickup = service.pickup_complete(oid, 20000)
        assert pickup["data"]["status"] == "picked_up"

        # 5. 배달 시작
        delivering = service.start_delivery(oid)
        assert delivering["data"]["status"] == "delivering"

        # 6. 배달 완료
        complete = service.complete_delivery(oid)
        assert complete["data"]["status"] == "completed"

        # SMS 로그 검증
        assert len(service.sms_log) >= 5
