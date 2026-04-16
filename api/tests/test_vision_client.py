import json
import unittest

from api.vision_client import clean_json_text, ensure_reverse_prompt_json, build_prompt_messages


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


if __name__ == "__main__":
    unittest.main()
