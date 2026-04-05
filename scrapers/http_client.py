"""HKD 공통 HTTP 클라이언트 - 세션 관리, 재시도, 타임아웃"""

import json
import logging
import ssl
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


class HttpClient:
    """재시도 및 타임아웃을 지원하는 HTTP 클라이언트"""

    def __init__(
        self,
        timeout: int = 15,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.headers = {**DEFAULT_HEADERS}
        if headers:
            self.headers.update(headers)

    def get(self, url: str, headers: Optional[Dict[str, str]] = None) -> str:
        """GET 요청 (텍스트 응답)"""
        return self._request(url, headers=headers)

    def get_json(self, url: str, headers: Optional[Dict[str, str]] = None) -> Any:
        """GET 요청 (JSON 응답)"""
        text = self._request(url, headers={**(headers or {}), "Accept": "application/json"})
        return json.loads(text)

    def post_json(self, url: str, data: Any, headers: Optional[Dict[str, str]] = None) -> Any:
        """POST 요청 (JSON 전송 및 응답)"""
        body = json.dumps(data).encode("utf-8")
        extra_headers = {"Content-Type": "application/json", **(headers or {})}
        text = self._request(url, data=body, headers=extra_headers)
        return json.loads(text)

    def _request(
        self,
        url: str,
        data: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> str:
        """내부 요청 실행 (재시도 로직 포함)"""
        merged_headers = {**self.headers}
        if headers:
            merged_headers.update(headers)

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                req = urllib.request.Request(url, data=data, headers=merged_headers)
                with urllib.request.urlopen(req, context=SSL_CONTEXT, timeout=self.timeout) as resp:
                    return resp.read().decode("utf-8", errors="replace")
            except Exception as e:
                last_error = e
                logger.warning(
                    "요청 실패 (%d/%d): %s - %s",
                    attempt,
                    self.max_retries,
                    url[:80],
                    e,
                )
                if attempt < self.max_retries:
                    time.sleep(self.retry_delay * attempt)

        raise ConnectionError(f"{self.max_retries}회 재시도 후 실패: {url[:80]} - {last_error}")
