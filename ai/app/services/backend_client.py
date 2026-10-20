"""Backend AI event API client. Only metadata paths are sent, never media bytes."""

from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class BackendApiError(RuntimeError):
    pass


class BackendEventClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None, timeout: float = 5.0):
        self.base_url = (base_url or os.getenv("BACKEND_URL", "")).rstrip("/")
        self.api_key = api_key or os.getenv("AI_API_KEY", "")
        self.timeout = timeout
        if not self.base_url or not self.api_key:
            raise ValueError("BACKEND_URL and AI_API_KEY must be configured")

    def _request(self, method: str, path: str, payload: dict) -> dict:
        request = Request(
            self.base_url + path,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-AI-API-KEY": self.api_key},
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                detail = error.read(500).decode("utf-8", errors="replace")
            finally:
                error.close()
            raise BackendApiError(f"Backend {method} {path} returned {error.code}: {detail}") from error
        except (URLError, TimeoutError) as error:
            raise BackendApiError(f"Backend {method} {path} failed: {error}") from error

    def create_event(self, payload: dict) -> int:
        response = self._request("POST", "/api/ai/events", payload)
        event_id = response.get("eventId")
        if not isinstance(event_id, int) or event_id <= 0:
            raise BackendApiError("Backend event response has no valid eventId")
        return event_id

    def update_media(self, event_id: int, video_path: str, pre_seconds: int, post_seconds: int) -> None:
        response = self._request("PATCH", f"/api/ai/events/{event_id}/media", {
            "videoPath": video_path,
            "preSeconds": pre_seconds,
            "postSeconds": post_seconds,
        })
        if response.get("eventId") != event_id or response.get("videoAvailable") is not True:
            raise BackendApiError("Backend media response does not confirm the update")
