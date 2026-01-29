from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import json
import asyncio
import io
import traceback
import sys

# Try imports that might fail if dependencies aren't perfect, to provide better error logs
try:
    from dotenv import load_dotenv
    import google.generativeai as genai
    from google.api_core import exceptions
    from PIL import Image
except ImportError as e:
    print(f"Import Error: {e}")
    # In Vercel, we might not see stdout easily, so we can't do much but hope
    pass

# Load environment variables (mostly for local dev, Vercel injects them)
try:
    load_dotenv()
except:
    pass

# Google Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configuration for Vercel
# If run locally, it will print warning. On Vercel, logging is captured.
if not GEMINI_API_KEY:
    print("Warning: GEMINI_API_KEY not set")

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"GenAI configure failed: {e}")

# Use Gemini Flash Latest
MODEL_NAME = "gemini-flash-latest"

try:
    model = genai.GenerativeModel(MODEL_NAME)
except:
    model = None

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
    if not model:
        raise Exception("Gemini Model not initialized (Check API Key or Dependencies)")

    for i in range(retries):
        try:
            return await model.generate_content_async(prompt_parts)
        except Exception as e:
            error_str = str(e)
            # Check for ResourceExhausted (429) or ServiceUnavailable (503)
            is_rate_limit = "429" in error_str or "ResourceExhausted" in error_str
            
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

@app.get("/api/health")
def health_check():
    return {"status": "ok", "model": MODEL_NAME, "api_key_set": bool(GEMINI_API_KEY)}

@app.get("/")
def read_root():
    return {"Hello": "World from Vercel"}

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
请务必输出标准、合法的 JSON 格式，且所有内容必须使用简体中文 (Simplified Chinese)。

JSON 结构如下：
{{
    "img_size": "{img_width}x{img_height}",
    "visual_colors": "色彩描述...",
    "description": "详细画面描述..."
}}

不要包含 Markdown 代码块标记（如 ```json），直接输出 JSON 字符串。
确保不需要任何后续处理即可被 json.loads 解析。
"""
        
        # USE RETRY HELPER
        response1 = await generate_with_retry([step1_prompt, pil_img])
        analysis_result = response1.text
        print(f"Analysis Result: {analysis_result[:100]}...")

        # If mode is JSON, return the analysis result directly
        if mode == "json":
            try:
                # Attempt to clean up potential markdown block if AI ignores instruction
                cleaned_json_str = re.sub(r'```json\n', '', analysis_result)
                cleaned_json_str = re.sub(r'```', '', cleaned_json_str).strip()
                
                # Parse to ensure it's valid JSON
                parsed_json = json.loads(cleaned_json_str)
                
                # Re-format for returning, although frontend might expect raw string or object
                # The user wants "Standard JSON format"
                return {
                    "result": json.dumps({
                        "图片物理尺寸": parsed_json.get("img_size", f"{img_width}x{img_height}"),
                        "视觉色彩": parsed_json.get("visual_colors", ""),
                        "详细画面描述": parsed_json.get("description", "")
                    }, ensure_ascii=False, indent=2)
                }
            except json.JSONDecodeError:
                # Fallback if AI fails to generate strict JSON
                print("JSON Decode Error, returning raw text")
                return {"result": analysis_result}

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
4. **格式规范**：必须是纯文本，不要包含 Markdown 代码块标记（如 ```json）。
5. **语言要求**：最终输出的 Prompt 必须翻译或保持为 **简体中文 (Simplified Chinese)**，方便用户阅读。哪怕生成的依然是生图词，也请用中文描述（或者中英对照，优先中文）。
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
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini API错误: {str(e)} - Check Vercel Logs for traceback"
        )
