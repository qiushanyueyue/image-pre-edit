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

        system_prompt = f"""# Role: 高级 AI 视觉架构师与提示词工程专家

## Core Mission:
你是一个专门为 NanoBanana (Gemini 生图) 打造的提示词转换引擎。你的任务是接收“一张参考图”和“一段用户大白话”，通过后台逻辑建模，输出一段工业级、高精度的中文生图提示词。

基于上一步的【视觉分析】以及用户的【提示词要求】，生成最终的生图提示词。

## 用户提示词要求 (Highest Priority):
{user_request}

## 视觉分析结果 (Context):
{analysis_result}

## Output Requirements (Strict):
1. **最高优先级**：必须**无条件、严格遵守**用户的【提示词要求】。如果用户要求修改画面（如“变成晚上”、“改成红色”），必须完全执行，并忽略视觉分析中冲突的部分。
2. **需求细化**：不仅仅是照搬用户的要求，必须对其进行**专业细化和扩展**。例如用户说“要科幻感”，你必须扩展为“赛博朋克风格、霓虹灯效、金属质感、未来建筑结构”等具体描述。
3. **元素统一**：在满足用户要求的前提下，保持其余非修改元素（构图、未提及的物体、基础材质）与原图【视觉分析结果】高度统一。
4. **格式规范**：必须是纯文本，不要包含 Markdown 代码块标记（如 ```json），不要包含任何解释、前缀或废话。只输出最终的 prompt 内容。
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
