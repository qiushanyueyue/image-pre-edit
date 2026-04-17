import json
import unittest
from unittest.mock import patch

from api.vision_client import (
    VisionModelClient,
    build_prompt_messages,
    clean_json_text,
    ensure_reverse_prompt_json,
    inspect_base_url_target,
)


class VisionClientTests(unittest.TestCase):
    def test_clean_json_text_removes_markdown_fence(self):
        raw_text = """```json
        {"画面主体":"现代别墅","场景环境":"城市街角"}
        ```"""

        cleaned = clean_json_text(raw_text)

        self.assertEqual(
            json.loads(cleaned),
            {"画面主体": "现代别墅", "场景环境": "城市街角"},
        )

    def test_ensure_reverse_prompt_json_fills_missing_fields(self):
        normalized = ensure_reverse_prompt_json(
            {"画面主体": "现代别墅", "色彩方案": "暖灰与木色", "图片尺寸": "1024x768"}
        )

        self.assertEqual(normalized["画面主体"], "现代别墅")
        self.assertEqual(normalized["图片尺寸"], "1024x768")
        self.assertIn("推荐生成提示词", normalized)
        self.assertIn("避免元素", normalized)
        self.assertEqual(normalized["避免元素"], [])

    def test_build_prompt_messages_uses_user_request_first(self):
        analysis = {
            "画面主体": "现代别墅",
            "场景环境": "临湖坡地",
            "构图方式": "三分法横构图",
            "推荐生成提示词": "现代别墅，临湖坡地，傍晚暖光"
        }

        messages = build_prompt_messages(analysis, "改成下雨夜景，增加灯光氛围")

        self.assertIn("改成下雨夜景，增加灯光氛围", messages["user"])
        self.assertIn("现代别墅", messages["user"])
        self.assertIn("推荐生成提示词", messages["user"])

    @patch("api.vision_client.socket.getaddrinfo")
    def test_inspect_base_url_target_marks_benchmark_ip_as_non_public(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [
            (2, 1, 6, "", ("198.18.21.120", 12524)),
        ]

        diagnostics = inspect_base_url_target("http://yytianjin.yyboxdns.com:12524")

        self.assertEqual(diagnostics["hostname"], "yytianjin.yyboxdns.com")
        self.assertEqual(diagnostics["resolved_ips"], ["198.18.21.120"])
        self.assertFalse(diagnostics["has_public_ip"])
        self.assertIn("非公网", diagnostics["warning"])

    @patch("api.vision_client.socket.getaddrinfo")
    def test_generate_appends_network_hint_when_target_is_not_public(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [
            (2, 1, 6, "", ("198.18.21.120", 12524)),
        ]

        client = VisionModelClient(base_url="http://yytianjin.yyboxdns.com:12524", model_name="gemma4:e4b", timeout=1)

        def fail_ollama(*_args, **_kwargs):
            raise ValueError("ollama failed")

        def fail_openai(*_args, **_kwargs):
            raise ValueError("openai failed")

        with patch.object(client, "_generate_via_ollama", side_effect=fail_ollama), \
             patch.object(client, "_generate_via_openai_compatible", side_effect=fail_openai):
            with self.assertRaises(RuntimeError) as ctx:
                client.generate("测试", b"fake-image")

        self.assertIn("ollama failed", str(ctx.exception))
        self.assertIn("198.18.21.120", str(ctx.exception))
        self.assertIn("非公网", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
