from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import json
import asyncio
import io
import traceback
import sys

# Lazy / Safe Import wrapper
def safe_import_genai():
    try:
        import google.generativeai as genai
        return genai
    except ImportError as e:
        print(f"GenAI Import Error: {e}")
        return None

def safe_import_pil():
    try:
        from PIL import Image
        return Image
    except ImportError as e:
        print(f"PIL Import Error: {e}")
        return None

# Initialize app FIRST to ensure Vercel can find the 'app' entry point instantly
app = FastAPI()

# Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load env vars
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-flash-latest"
genai_lib = safe_import_genai()
pil_lib = safe_import_pil()

# Configure GenAI immediately if available, but don't crash if not
model = None
if genai_lib and GEMINI_API_KEY:
    try:
        genai_lib.configure(api_key=GEMINI_API_KEY)
        model = genai_lib.GenerativeModel(MODEL_NAME)
    except Exception as e:
        print(f"GenAI Init Failed: {e}")

async def generate_with_retry(prompt_parts, retries=5, default_delay=5):
    if not model:
        raise HTTPException(status_code=503, detail="Gemini Model not initialized (Import failed or Key missing)")

    for i in range(retries):
        try:
            return await model.generate_content_async(prompt_parts)
        except Exception as e:
            error_str = str(e)
            is_rate_limit = "429" in error_str or "ResourceExhausted" in error_str
            
            if is_rate_limit:
                if i == retries - 1:
                    print(f"Rate limit hit. Max retries ({retries}) exceeded.")
                    raise e
                wait_time = default_delay * (2 ** i)
                match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+(\.\d+)?)', error_str)
                if match:
                    wait_time = float(match.group(1)) + 1.0
                print(f"Rate limit hit (429). Retrying in {wait_time:.2f}s...")
                await asyncio.sleep(wait_time)
            else:
                raise e

@app.get("/api/health")
def health_check():
    return {
        "status": "ok", 
        "model": MODEL_NAME, 
        "api_key_set": bool(GEMINI_API_KEY),
        "deps": {
            "genai": bool(genai_lib),
            "pil": bool(pil_lib)
        }
    }

@app.get("/api/debug-env")
def debug_env():
    data = {}
    try:
        import sys
        import importlib.metadata
        data["python_version"] = sys.version
        data["packages"] = [
            f"{dist.metadata['Name']}=={dist.version}"
            for dist in importlib.metadata.distributions()
        ]
    except Exception as e:
        data["error"] = str(e)
    
    data["env_vars"] = [k for k in os.environ.keys() if "GEMINI" in k or "VERCEL" in k]
    data["status"] = "ok"
    return data

@app.get("/")
def read_root():
    return {"Hello": "World from Vercel"}

@app.post("/api/ai-analyze")
async def ai_analyze(
    user_request: str = Form(""),
    image: UploadFile = File(...),
    mode: str = Form("prompt")
):
    # Check dependencies at runtime
    if not genai_lib or not model:
         raise HTTPException(status_code=503, detail="Google Generative AI library failed to load or API Key invalid.")
    
    if not pil_lib:
         raise HTTPException(status_code=503, detail="Pillow (Image library) failed to load.")

    try:
        print(f"Received request: {user_request}, mode: {mode}")
        
        # Read image content
        image_content = await image.read()
        pil_img = pil_lib.open(io.BytesIO(image_content))
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
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini API错误: {str(e)} - Check Vercel Logs for traceback"
        )
