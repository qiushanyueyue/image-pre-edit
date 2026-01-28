from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
import re
import base64
import json

# Load environment variables
load_dotenv()

# Custom Qwen-VL Client Configuration
import os
from openai import AsyncOpenAI

# Endpoint and Key should be set in .env or Vercel Environment Variables
qwen_api_key = os.getenv("QWEN_VL_API_KEY", "ollama")
qwen_endpoint = os.getenv("QWEN_VL_ENDPOINT", "http://yytianjin.yyboxdns.com:12524/v1") # Default fallback for local

if not qwen_endpoint:
    print("Warning: QWEN_VL_ENDPOINT not set. AI features may fail.")

client = AsyncOpenAI(
    api_key=qwen_api_key,
    base_url=qwen_endpoint
)
MODEL_NAME = "qwen3-vl:235b-cloud"

app = FastAPI()

# Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        base64_image = base64.b64encode(image_content).decode('utf-8')
        image_url = f"data:image/jpeg;base64,{base64_image}"

        # Get actual image dimensions using PIL
        import io
        from PIL import Image
        pil_img = Image.open(io.BytesIO(image_content))
        img_width, img_height = pil_img.size
        
        # Step 1: Visual Analysis (Using Qwen-VL)
        print("Step 1: Analyzing image with Qwen-VL...")
        
        # Simplified prompt as per user request
        step1_prompt = f"""
分析这张图片。
输出一段简单的纯文本分析，包含以下信息：
1. 图片尺寸 (Image Size): {img_width}x{img_height} (已自动读取)
2. 视觉色彩 (Visual Colors): 主色调、配色方案
3. 详细画面描述 (Detailed Description): 主体、环境、光影、风格

不需要严格的JSON格式，清晰列出即可。
"""
        
        response1 = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": step1_prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            max_tokens=2048
        )
        
        analysis_result = response1.choices[0].message.content
        print(f"Analysis Result: {analysis_result[:100]}...")

        # If mode is JSON, return the analysis result directly
        if mode == "json":
            # Remove Markdown code blocks if present
            cleaned_json = re.sub(r'```json\n', '', analysis_result)
            cleaned_json = re.sub(r'```', '', cleaned_json).strip()
            
            return {
                "result": f"""{{
  "图片物理尺寸": "{img_width}x{img_height}",
  "AI分析内容": {cleaned_json if cleaned_json.startswith('{') else f'"{cleaned_json}"'}
}}"""
            }

        # Step 2: Prompt Generation
        print("Step 2: Generating final prompt with strict adherence...")
        
        if not user_request:
            user_request = "保持原图风格，优化细节质感"

        # STRICT SYSTEM PROMPT (Migrated from Gemini)
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

        response2 = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "请开始生成。"}
            ],
            max_tokens=2048
        )
        
        final_result = response2.choices[0].message.content
        final_result = re.sub(r'```[a-zA-Z]*\n', '', final_result)
        final_result = re.sub(r'```', '', final_result)
        final_result = re.sub(r'^\s*\{.*?\}\s*', '', final_result, flags=re.DOTALL) 
        
        return {"result": final_result.strip()}

    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Gemini API错误: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8011, reload=True)
