from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv
import re
import base64
import json
import google.generativeai as genai
from PIL import Image
import io

# Load environment variables
load_dotenv()

# Google Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Warning: GEMINI_API_KEY not set in .env")

genai.configure(api_key=GEMINI_API_KEY)

import asyncio
from google.api_core import exceptions

# ...

# Use Gemini Flash Latest (Likely 1.5 Flash which has better Free Tier)
MODEL_NAME = "gemini-flash-latest"
model = genai.GenerativeModel(MODEL_NAME)

app = FastAPI()

# Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def generate_with_retry(prompt_parts, retries=5, default_delay=5):
    """
    Helper function to generate content with smart retry logic for 429 errors.
    """
    for i in range(retries):
        try:
            return await model.generate_content_async(prompt_parts)
        except Exception as e:
            error_str = str(e)
            is_rate_limit = isinstance(e, exceptions.ResourceExhausted) or "429" in error_str
            
            if is_rate_limit:
                if i == retries - 1:
                    print(f"Rate limit hit. Max retries ({retries}) exceeded.")
                    raise e
                
                # Smart delay: Try to parse "retry_delay { seconds: X }"
                wait_time = default_delay * (2 ** i) # Default backoff
                
                # Regex to find "retry_delay { seconds: 35 }" or similar
                match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+(\.\d+)?)', error_str)
                if match:
                    parsed_delay = float(match.group(1))
                    wait_time = parsed_delay + 1.0 # Add 1s buffer
                    print(f"Found explicit retry delay in error: {wait_time}s")
                
                print(f"Rate limit hit (429). Retrying in {wait_time:.2f}s... (Attempt {i+1}/{retries})")
                await asyncio.sleep(wait_time)
            else:
                raise e

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/api/ai-analyze")
async def ai_analyze(
    user_request: str = Form(""),
    image: UploadFile = File(...),
    mode: str = Form("prompt") # "json" or "prompt"
):
    try:
        print(f"Received request: {user_request}, mode: {mode}")
        
        # Read image content
        image_content = await image.read()
        pil_img = Image.open(io.BytesIO(image_content))
        img_width, img_height = pil_img.size
        
        # Step 1: Visual Analysis
        print(f"Step 1: Analyzing image with {MODEL_NAME}...")
        
        step1_prompt = f"""
分析这张图片。
输出一段简单的纯文本分析，包含以下信息：
1. 图片尺寸 (Image Size): {img_width}x{img_height} (已自动读取)
2. 视觉色彩 (Visual Colors): 主色调、配色方案
3. 详细画面描述 (Detailed Description): 主体、环境、光影、风格

不需要严格的JSON格式，清晰列出即可。
"""
        
        # USE RETRY HELPER
        response1 = await generate_with_retry([step1_prompt, pil_img])
        analysis_result = response1.text
        print(f"Analysis Result: {analysis_result[:100]}...")

        # If mode is JSON, return the analysis result directly
        if mode == "json":
            cleaned_json = re.sub(r'```json\n', '', analysis_result)
            cleaned_json = re.sub(r'```', '', cleaned_json).strip()
            return {
                "result": f"""{{
  "图片物理尺寸": "{img_width}x{img_height}",
  "AI分析内容": {json.dumps(cleaned_json, ensure_ascii=False)}
}}"""
            }

        # Step 2: Prompt Generation
        print("Step 2: Generating final prompt with strict adherence...")
        
        if not user_request:
            user_request = "保持原图风格，优化细节质感"

        system_prompt = f"""## Role: Google Gemini / Imagen 3 专用高级提示词专家 (Prompt Engineer)

## Core Mission:
你不是在描述原图，而是在**基于原图结构 + 用户指令**，重新创作一段全新的生图提示词。
**核心原则：用户的指令 (User Request) 是绝对的主角，原图分析 (Visual Analysis) 只是配角（仅提供构图和基础材质参考）。**

## Input Context:
1. **User Request (用户指令 - 100% 优先级)**: 
{user_request}

2. **Visual Analysis (原图参考 - 仅作辅助)**:
{analysis_result}

## Reasoning Logic (思维链 - 必须严格遵循):
1. **提取核心 (Focus)**: 
   - 提取用户指令中的关键词（如“赛博朋克”、“下雨”、“红色调”）。
   - **生成的提示词必须用 80% 的篇幅来描述这些用户想要的内容。**
   
2. **过滤干扰 (Filter)**:
   - 检查原图分析中，有哪些元素与用户指令**无关**或**冲突**？
   - **无关的细节（如原图中不起眼的路人、杂乱的背景）统统丢弃，不要写进提示词！**
   - **冲突的细节（如用户要晚上，原图是白天）必须彻底覆盖。**

3. **细节脑补 (Expansion)**:
   - 针对用户的指令进行疯狂扩写。
   - 用户说“要科幻”，你必须扩写：“巨大的全息投影广告，湿漉漉的霓虹倒影，机械义肢的行人，反重力载具...”。
   - 用户说“要唯美”，你必须扩写：“丁达尔光效，梦幻的粒子漂浮，柔焦镜头，印象派色调...”。

## Output Format & Rules (Strict):
1. **Output Language**: **必须使用简体中文 (Simplified Chinese)**。
2. **Format**: 直接输出最终的 Prompt 内容，**不要包含任何 Markdown 标记**，不要包含“生成的提示词如下”等废话。
3. **Content Style**: 
   - **重点突出**：把用户想要的内容放在最前面描述。
   - **画面感**：使用电影级的布光和材质词汇。
"""

        # USE RETRY HELPER
        response2 = await generate_with_retry(system_prompt)
        final_result = response2.text
        
        # Clean up output
        final_result = re.sub(r'```[a-zA-Z]*\n', '', final_result)
        final_result = re.sub(r'```', '', final_result)
        final_result = final_result.strip()
        
        return {"result": final_result}

    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        # Print full Traceback for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini API错误: {str(e)}"
        )

if __name__ == "__main__":
    # Ensure standard output is flushed
    import sys
    sys.stdout.reconfigure(line_buffering=True)
    uvicorn.run("main:app", host="0.0.0.0", port=8011, reload=True)
