import io
import json
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from http.server import BaseHTTPRequestHandler, HTTPServer

from app.services.backend_client import BackendApiError, BackendEventClient


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class BackendClientTest(unittest.TestCase):
    def test_real_http_requests_match_backend_contract(self):
        received = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                self.respond({"eventId": 31, "reviewStatus": "UNREVIEWED"})

            def do_PATCH(self):
                self.respond({"eventId": 31, "videoAvailable": True})

            def respond(self, payload):
                received.append((self.command, self.path, self.headers.get("X-AI-API-KEY"),
                                 json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
                body = json.dumps(payload).encode()
                self.send_response(201 if self.command == "POST" else 200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            client = BackendEventClient(f"http://127.0.0.1:{server.server_port}", "test-key")
            event_id = client.create_event({"cameraId": "camera-1", "eventType": "FIRE"})
            client.update_media(event_id, "/shared/event.mp4", 5, 5)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
        self.assertEqual([(method, path, key) for method, path, key, _ in received], [
            ("POST", "/api/ai/events", "test-key"),
            ("PATCH", "/api/ai/events/31/media", "test-key"),
        ])
        self.assertEqual(received[1][3]["postSeconds"], 5)

    def test_create_and_update_use_contract(self):
        client = BackendEventClient("http://backend:8080", "secret")
        with patch("app.services.backend_client.urlopen", side_effect=[
            Response(b'{"eventId":31,"reviewStatus":"UNREVIEWED"}'),
            Response(b'{"eventId":31,"videoAvailable":true}'),
        ]) as request:
            event_id = client.create_event({"cameraId": "camera-1"})
            client.update_media(event_id, "/storage/events/31.mp4", 5, 5)
        self.assertEqual(event_id, 31)
        first = request.call_args_list[0].args[0]
        second = request.call_args_list[1].args[0]
        self.assertEqual(first.full_url, "http://backend:8080/api/ai/events")
        self.assertEqual(first.get_method(), "POST")
        self.assertEqual(first.get_header("X-ai-api-key"), "secret")
        self.assertEqual(json.loads(second.data)["preSeconds"], 5)
        self.assertEqual(second.get_method(), "PATCH")

    def test_rejected_post_is_not_retried(self):
        client = BackendEventClient("http://backend:8080", "secret")
        error = HTTPError("http://backend", 404, "missing camera", {}, io.BytesIO(b'CAMERA_NOT_FOUND'))
        with patch("app.services.backend_client.urlopen", side_effect=error) as request:
            with self.assertRaisesRegex(BackendApiError, "404"):
                client.create_event({"cameraId": "absent"})
        self.assertEqual(request.call_count, 1)


if __name__ == "__main__":
    unittest.main()
