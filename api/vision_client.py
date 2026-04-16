from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from typing import Any

import requests

DEFAULT_MODEL_NAME = "gemma4:e4b"
DEFAULT_BASE_URL = "http://yytianjin.yyboxdns.com:12524"

JSON_FIELD_DEFAULTS: dict[str, Any] = {
    "图片尺寸": "",
    "画面主体": "",
    "场景环境": "",
    "构图方式": "",
    "镜头视角": "",
    "景别": "",
    "光线与时间": "",
    "色彩方案": "",
    "材质与细节": "",
    "风格特征": "",
    "空间层次": "",
    "氛围关键词": [],
    "避免元素": [],
    "推荐生成提示词": "",
}


def clean_json_text(raw_text: str) -> str:
    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    start_indexes = [idx for idx in (text.find("{"), text.find("[")) if idx != -1]
    end_indexes = [idx for idx in (text.rfind("}"), text.rfind("]")) if idx != -1]
    if start_indexes and end_indexes:
        start = min(start_indexes)
        end = max(end_indexes)
        if end > start:
            text = text[start : end + 1]
    return text.strip()


def _normalize_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item.strip() for item in map(str, value) if item and str(item).strip()]
    if isinstance(value, str):
        pieces = re.split(r"[，,；;、\n]+", value)
        return [piece.strip() for piece in pieces if piece.strip()]
    return [_normalize_string(value)] if _normalize_string(value) else []


def ensure_reverse_prompt_json(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(JSON_FIELD_DEFAULTS)

    for key in normalized:
        if key in {"氛围关键词", "避免元素"}:
            normalized[key] = _normalize_list(data.get(key))
        else:
            normalized[key] = _normalize_string(data.get(key))

    normalized["推荐生成提示词"] = normalized["推荐生成提示词"] or build_recommended_prompt(normalized)
    return normalized


def build_recommended_prompt(analysis: dict[str, Any]) -> str:
    prompt_parts: list[str] = []
    for key in (
        "画面主体",
        "场景环境",
        "构图方式",
        "镜头视角",
        "景别",
        "光线与时间",
        "色彩方案",
        "材质与细节",
        "风格特征",
    ):
        value = _normalize_string(analysis.get(key))
        if value:
            prompt_parts.append(value)

    for key in ("空间层次",):
        value = _normalize_string(analysis.get(key))
        if value:
            prompt_parts.append(value)

    keyword_text = "、".join(_normalize_list(analysis.get("氛围关键词")))
    if keyword_text:
        prompt_parts.append(f"氛围关键词：{keyword_text}")

    return "，".join(prompt_parts)


def build_analysis_prompt(img_width: int, img_height: int) -> str:
    field_template = json.dumps(
        {
            "图片尺寸": f"{img_width}x{img_height}",
            "画面主体": "主体是什么，数量和主要外观特征",
            "场景环境": "所在环境、建筑/自然/室内外信息",
            "构图方式": "居中、三分法、对称、引导线等",
            "镜头视角": "平视、俯视、仰视、航拍等",
            "景别": "特写、近景、中景、远景等",
            "光线与时间": "白天/夜晚/黄昏及光线方向和质感",
            "色彩方案": "主色、辅色、冷暖关系和整体色调",
            "材质与细节": "木材、玻璃、金属、皮肤、植被等纹理质感",
            "风格特征": "写实、电影感、极简、赛博朋克等",
            "空间层次": "前景、中景、背景以及纵深关系",
            "氛围关键词": ["宁静", "高级", "通透"],
            "避免元素": ["水印", "文字", "变形人物"],
            "推荐生成提示词": "把上面信息串成一段适合文生图的中文提示词",
        },
        ensure_ascii=False,
        indent=2,
    )

    return (
        "你是图像反推分析助手。请根据输入图片输出可直接用于文生图反推的中文 JSON。"
        "所有字段必须保留，内容必须用简体中文，不能输出 Markdown 代码块，不能解释。"
        f"图片尺寸已经确认是 {img_width}x{img_height}。"
        "输出结构必须严格匹配下面的 JSON 字段，允许你根据图片内容填写更准确的值：\n"
        f"{field_template}\n"
        "要求：\n"
        "1. 字段内容尽量具体，不要只写泛泛词。\n"
        "2. 推荐生成提示词要能用来重新生成接近原图的画面。\n"
        "3. 避免元素必须是数组。\n"
        "4. 氛围关键词必须是数组。\n"
    )


def build_prompt_messages(analysis: dict[str, Any], user_request: str) -> dict[str, str]:
    normalized = ensure_reverse_prompt_json(analysis)
    request_text = user_request.strip() or "保持原图结构和材质逻辑，优化清晰度与细节表现"
    analysis_text = json.dumps(normalized, ensure_ascii=False, indent=2)

    return {
        "system": (
            "你是图像生成提示词专家。你的任务是基于结构化画面分析和用户修改要求，"
            "直接输出一段简体中文提示词，不要解释，不要 Markdown，不要编号。"
            "用户要求优先于原图分析。"
        ),
        "user": (
            f"用户要求：{request_text}\n"
            "下面是原图的结构化反推 JSON，请保留与用户要求不冲突的构图、材质、光线、色彩信息，"
            "并在最终结果里输出一段适合文生图的中文提示词：\n"
            f"{analysis_text}"
        ),
    }


def safe_json_loads(raw_text: str, img_width: int, img_height: int) -> dict[str, Any]:
    cleaned_text = clean_json_text(raw_text)
    try:
        parsed = json.loads(cleaned_text)
        if not isinstance(parsed, dict):
            raise ValueError("JSON root is not an object")
        return ensure_reverse_prompt_json(
            {
                "图片尺寸": f"{img_width}x{img_height}",
                **parsed,
            }
        )
    except Exception:
        return ensure_reverse_prompt_json(
            {
                "图片尺寸": f"{img_width}x{img_height}",
                "画面主体": cleaned_text,
                "推荐生成提示词": cleaned_text,
            }
        )


def clean_text_response(raw_text: str) -> str:
    text = raw_text.strip()
    text = re.sub(r"^```(?:text|markdown)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


@dataclass
class VisionModelClient:
    base_url: str = DEFAULT_BASE_URL
    model_name: str = DEFAULT_MODEL_NAME
    timeout: int = 90

    @classmethod
    def from_env(cls) -> "VisionModelClient":
        return cls(
            base_url=os.getenv("VISION_API_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
            model_name=os.getenv("VISION_MODEL_NAME", DEFAULT_MODEL_NAME),
            timeout=int(os.getenv("VISION_API_TIMEOUT", "90")),
        )

    def generate(self, prompt: str, image_bytes: bytes | None = None) -> str:
        errors: list[str] = []
        for transport in (self._generate_via_ollama, self._generate_via_openai_compatible):
            try:
                return transport(prompt, image_bytes)
            except requests.HTTPError as exc:
                status_code = exc.response.status_code if exc.response is not None else "unknown"
                if status_code not in (400, 404, 405):
                    raise
                errors.append(f"{transport.__name__}:{status_code}")
            except (KeyError, ValueError, requests.RequestException) as exc:
                errors.append(f"{transport.__name__}:{exc}")
        raise RuntimeError(f"无法从视觉分析服务获取结果：{' | '.join(errors)}")

    def _generate_via_ollama(self, prompt: str, image_bytes: bytes | None = None) -> str:
        payload: dict[str, Any] = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
        }
        if image_bytes:
            payload["images"] = [base64.b64encode(image_bytes).decode("utf-8")]

        response = requests.post(
            f"{self.base_url}/api/generate",
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()
        text = data.get("response")
        if not text:
            raise ValueError("ollama response missing `response`")
        return str(text)

    def _generate_via_openai_compatible(self, prompt: str, image_bytes: bytes | None = None) -> str:
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        if image_bytes:
            encoded_image = base64.b64encode(image_bytes).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{encoded_image}",
                    },
                }
            )

        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.2,
        }
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()
        text = data["choices"][0]["message"]["content"]
        if isinstance(text, list):
            text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
        return str(text)
