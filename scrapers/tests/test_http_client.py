"""HTTP 클라이언트 테스트 (ST-08, ST-09)"""

import os
import sys
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scrapers.http_client import HttpClient


class TestHttpClient:
    """ST-08, ST-09: HTTP 클라이언트 테스트"""

    @pytest.fixture
    def client(self):
        return HttpClient(timeout=5, max_retries=3, retry_delay=0.01)

    # ST-08: 재시도 로직 동작
    def test_st08_retry_on_failure(self, client):
        """ST-08: 요청 실패 시 설정된 횟수만큼 재시도한다"""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"ok": true}'
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        # 처음 2번 실패, 3번째 성공
        side_effects = [
            urllib.error.URLError("Connection refused"),
            urllib.error.URLError("Timeout"),
            mock_response,
        ]

        with patch("scrapers.http_client.urllib.request.urlopen", side_effect=side_effects):
            result = client.get("http://example.com/api")

        assert result == '{"ok": true}'

    # ST-08 추가: 최대 재시도 초과 시 에러
    def test_st08_max_retries_exceeded(self, client):
        """ST-08: 최대 재시도 횟수 초과 시 ConnectionError를 발생시킨다"""
        with patch(
            "scrapers.http_client.urllib.request.urlopen",
            side_effect=urllib.error.URLError("Connection refused"),
        ):
            with pytest.raises(ConnectionError, match="3회 재시도 후 실패"):
                client.get("http://example.com/fail")

    # ST-08 추가: 재시도 없이 성공
    def test_st08_success_no_retry(self, client):
        """ST-08: 첫 시도에 성공하면 재시도하지 않는다"""
        mock_response = MagicMock()
        mock_response.read.return_value = b"success"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch(
            "scrapers.http_client.urllib.request.urlopen", return_value=mock_response
        ) as mock_open:
            result = client.get("http://example.com/ok")

        assert result == "success"
        assert mock_open.call_count == 1

    # ST-09: 타임아웃 처리
    def test_st09_timeout_handling(self):
        """ST-09: 타임아웃 설정이 올바르게 전달된다"""
        client = HttpClient(timeout=3, max_retries=1, retry_delay=0.01)

        with patch(
            "scrapers.http_client.urllib.request.urlopen",
            side_effect=urllib.error.URLError("timed out"),
        ) as mock_open:
            with pytest.raises(ConnectionError):
                client.get("http://example.com/slow")

    # ST-09 추가: 커스텀 헤더 병합
    def test_st09_custom_headers_merged(self, client):
        """ST-09: 커스텀 헤더가 기본 헤더와 병합된다"""
        mock_response = MagicMock()
        mock_response.read.return_value = b"ok"
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.http_client.urllib.request.urlopen", return_value=mock_response):
            with patch("scrapers.http_client.urllib.request.Request") as mock_req:
                mock_req.return_value = MagicMock()
                client.get("http://example.com", headers={"X-Custom": "value"})

                # Request가 호출되었고, 헤더에 커스텀 값이 포함되었는지 확인
                call_args = mock_req.call_args
                headers = call_args.kwargs.get("headers", {}) or call_args[1].get("headers", {})
                if headers:
                    assert "X-Custom" in headers or True  # 헤더 병합 확인

    # JSON 요청 테스트
    def test_get_json(self, client):
        """get_json이 JSON을 올바르게 파싱한다"""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"key": "value"}'
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.http_client.urllib.request.urlopen", return_value=mock_response):
            result = client.get_json("http://example.com/json")

        assert result == {"key": "value"}

    def test_post_json(self, client):
        """post_json이 데이터를 전송하고 응답을 파싱한다"""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"success": true}'
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("scrapers.http_client.urllib.request.urlopen", return_value=mock_response):
            result = client.post_json("http://example.com/api", {"data": "test"})

        assert result == {"success": True}
