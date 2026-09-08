"""Meaningful integration tests: persistence, child isolation, restore, local-only API."""
import base64
import contextlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("mac_server", Path(__file__).resolve().parents[1] / "tools/mac_server.py")
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLfoAAAAASUVORK5CYII="


class MacLabTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.server = app.make_server(0, Path(self.tmp.name) / "test.sqlite3")
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": .01}, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.tmp.cleanup()

    def request(self, path, body=None, headers=None):
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
            headers=headers if headers is not None else {"Content-Type": "application/json", "X-PocketPal": "mac-lab"})
        try:
            response = urllib.request.urlopen(req, timeout=4)
        except urllib.error.HTTPError as exc:
            response = exc
        raw = response.read()
        return response.status, json.loads(raw) if response.headers.get_content_type() == "application/json" else raw

    def test_names_memories_and_gifts_survive_server_restart(self):
        self.assertEqual(self.request("/api/profile", {"profile":"child-1", "child_name":"테스트 아이", "pal_name":"포켓 친구"})[0], 200)
        self.request("/api/memory", {"profile":"child-1", "text":"나는 공룡을 좋아해"})
        gift = {"name":"시험 선물", "slot":"head", "image":PNG}
        self.request("/api/gift", {"profile":"child-1", "gift":gift})
        storage = self.server.store.path
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.server = app.make_server(0, storage)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": .01}, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.server.server_port)
        reopened = self.request("/api/state?profile=child-1")[1]
        self.assertEqual(reopened["child_name"], "테스트 아이")
        self.assertEqual(reopened["memories"][0]["text"], "나는 공룡을 좋아해")
        self.assertEqual(reopened["gift"], gift)

    def test_child_memories_gifts_and_replies_are_separate(self):
        self.request("/api/memory", {"profile":"child-1", "text":"티라노사우루스를 좋아해"})
        self.request("/api/gift", {"profile":"child-1", "gift":{"name":"배지", "slot":"badge", "image":PNG}})
        second = self.request("/api/state?profile=child-2")[1]
        self.assertEqual(second["memories"], []); self.assertIsNone(second["gift"])
        first_reply = self.request("/api/chat", {"profile":"child-1", "text":"내가 좋아하는 걸 기억해?"})[1]
        second_reply = self.request("/api/chat", {"profile":"child-2", "text":"내가 좋아하는 걸 기억해?"})[1]
        self.assertIn("티라노", first_reply["reply"]); self.assertNotIn("티라노", second_reply["reply"])

    def test_backup_delete_and_restore_round_trip(self):
        for pid in app.PROFILE_IDS:
            self.request("/api/memory", {"profile":pid, "text":pid + " 기억"})
        backup = self.request("/api/backup")[1]
        self.request("/api/reset", {"profile":"child-1", "confirm":"DELETE"})
        self.assertEqual(len(self.request("/api/state?profile=child-2")[1]["memories"]), 1)
        self.assertEqual(self.request("/api/restore", {"confirm":"RESTORE", "backup":backup})[0], 200)
        restored = self.request("/api/backup")[1]
        for before, after in zip(backup["profiles"], restored["profiles"]):
            for key in ("id", "child_name", "pal_name", "memories", "messages", "gift", "bond"):
                self.assertEqual(before[key], after[key])

    def test_character_choice_survives_restart_and_backup(self):
        self.assertEqual(self.request("/api/appearance", {"profile":"child-1", "skin":"frog"})[0], 200)
        self.assertEqual(self.request("/api/appearance", {"profile":"child-2", "skin":"pink"})[0], 200)
        reopened = app.Store(self.server.store.path)
        self.assertEqual(reopened.get("child-1")["skin"], "frog")
        self.assertEqual(reopened.get("child-2")["skin"], "pink")
        backup = self.request("/api/backup")[1]
        self.request("/api/appearance", {"profile":"child-1", "skin":"pink"})
        self.request("/api/restore", {"confirm":"RESTORE", "backup":backup})
        self.assertEqual(self.request("/api/state?profile=child-1")[1]["skin"], "frog")
        self.assertEqual(self.request("/api/appearance", {"profile":"child-1", "skin":"../../bad"})[0], 400)
        self.assertEqual(self.request("/api/state?profile=child-1")[1]["skin"], "frog")

    def test_old_backup_keeps_memories_and_adds_default_characters(self):
        self.request("/api/memory", {"profile":"child-1", "text":"이전 버전의 기억"})
        backup = self.request("/api/backup")[1]
        for profile in backup["profiles"]:
            profile.pop("skin", None)
        self.assertEqual(self.request("/api/restore", {"confirm":"RESTORE", "backup":backup})[0], 200)
        restored = self.request("/api/state?profile=child-1")[1]
        self.assertEqual(restored["skin"], "pink")
        self.assertEqual(restored["memories"][0]["text"], "이전 버전의 기억")
        self.assertEqual(self.request("/api/state?profile=child-2")[1]["skin"], "frog")

    def test_invalid_restore_is_atomic(self):
        self.request("/api/memory", {"profile":"child-1", "text":"남아야 하는 기억"})
        backup = self.request("/api/backup")[1]
        backup["profiles"][0]["memories"] = []
        backup["profiles"][1]["bond"] = "invalid"
        self.assertEqual(self.request("/api/restore", {"confirm":"RESTORE", "backup":backup})[0], 400)
        self.assertEqual(self.request("/api/state")[1]["memories"][0]["text"], "남아야 하는 기억")

    def test_destructive_actions_require_explicit_confirmation(self):
        self.assertEqual(self.request("/api/reset", {"profile":"child-1"})[0], 400)
        self.assertEqual(self.request("/api/restore", {"backup":self.server.store.backup()})[0], 400)

    def test_foreign_origin_and_host_cannot_access_data(self):
        self.assertEqual(self.request("/api/state", headers={"Origin":"https://example.com"})[0], 403)
        self.assertEqual(self.request("/api/state", headers={"Host":"attacker.example"})[0], 403)
        self.assertEqual(self.request("/api/memory", {"text":"not saved"}, headers={"Content-Type":"application/json"})[0], 403)

    def test_code_and_database_are_not_served(self):
        for path in ("/tools/mac_server.py", "/../tools/mac_server.py", "/%2e%2e/tools/mac_server.py", "/.test-data/pocketpal.sqlite3", "/legacy/app.js"):
            self.assertEqual(self.request(path)[0], 404, path)
        for path in ("/", "/app.js", "/styles.css", "/legacy/soul-character.css", "/legacy/base-body-v01.css"):
            code, content = self.request(path)
            self.assertEqual(code, 200); self.assertTrue(content)

    def test_basic_mode_performs_no_outgoing_requests(self):
        with patch.object(app, "ollama_request", side_effect=AssertionError("Unexpected network")):
            self.assertEqual(self.request("/api/chat", {"text":"안녕"})[0], 200)
            self.assertEqual(self.request("/api/action", {"action":"proactive"})[0], 200)

    def test_bad_gifts_unknown_profiles_and_long_text_are_rejected(self):
        self.assertEqual(self.request("/api/state?profile=unknown")[0], 400)
        self.assertEqual(self.request("/api/memory", {"text":"x" * 241})[0], 400)
        self.assertEqual(self.request("/api/gift", {"gift":{"name":"x", "slot":"head", "image":"data:image/svg+xml,<svg/>"}})[0], 400)

    def test_concurrent_memory_writes_are_preserved(self):
        threads = [threading.Thread(target=lambda n=i: self.request("/api/memory", {"text":"memory " + str(n)})) for i in range(8)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(len(self.request("/api/state")[1]["memories"]), 8)

    def test_ai_adapter_receives_only_selected_child_context(self):
        self.request("/api/memory", {"profile":"child-1", "text":"첫째는 공룡"})
        self.request("/api/memory", {"profile":"child-2", "text":"둘째는 우주"})
        calls = []
        def fake_ollama(path, payload=None, timeout=3):
            calls.append((path, payload))
            if path == "/api/tags": return {"models":[{"name":"qwen3:1.7b"}]}
            return {"message":{"content":"공룡 이야기를 해 볼까?"}}
        with patch.object(app, "ollama_request", side_effect=fake_ollama):
            code, response = self.request("/api/chat", {"profile":"child-1", "text":"안녕", "mode":"ollama", "model":"qwen3:1.7b"})
        self.assertEqual(code, 200)
        payload = calls[-1][1]
        self.assertIn("첫째는 공룡", payload["messages"][0]["content"])
        self.assertNotIn("둘째는 우주", json.dumps(payload, ensure_ascii=False))
        self.assertFalse(payload["stream"]); self.assertFalse(payload["think"])
        self.assertEqual(response["source"], "ollama")

    def test_failed_ai_does_not_fake_a_reply_or_save_incomplete_turn(self):
        with patch.object(app, "ollama_request", side_effect=urllib.error.URLError("offline")):
            self.assertEqual(self.request("/api/chat", {"text":"안녕", "mode":"ollama"})[0], 503)
        self.assertEqual(self.request("/api/state")[1]["messages"], [])

    def test_cloud_model_is_rejected(self):
        with patch.object(app, "ollama_request", return_value={"models":[{"name":"example:cloud", "remote_host":"ollama.com"}]}):
            self.assertEqual(self.request("/api/chat", {"text":"안녕", "mode":"ollama", "model":"example:cloud"})[0], 400)

    def test_stale_ai_turn_does_not_restore_deleted_state(self):
        revision = self.server.store.get("child-1")["revision"]
        self.request("/api/reset", {"confirm":"DELETE"})
        with self.assertRaises(ValueError):
            self.server.store.update("child-1", lambda p: p.update(child_name="stale"), expected=revision)
        self.assertEqual(self.server.store.get("child-1")["child_name"], "")


if __name__ == "__main__":
    unittest.main()
