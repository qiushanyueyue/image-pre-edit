from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
import re
import base64
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

app = FastAPI()

# Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Qwen-VL Client Configuration
# Endpoint and Key should be set in .env or Vercel Environment Variables
qwen_api_key = os.getenv("QWEN_VL_API_KEY", "ollama")
qwen_endpoint = os.getenv("QWEN_VL_ENDPOINT")

if not qwen_endpoint:
    print("Warning: QWEN_VL_ENDPOINT not set. AI features may fail.")

client = AsyncOpenAI(
    api_key=qwen_api_key,
    base_url=qwen_endpoint
)
MODEL_NAME = "qwen3-vl:235b-cloud"

class PromptRequest(BaseModel):
    image: str
    user_request: str = ""

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
        
        # Read and encode image to Base64
        image_content = await image.read()
        base64_image = base64.b64encode(image_content).decode('utf-8')
        image_url = f"data:image/jpeg;base64,{base64_image}" # Assuming jpeg/png generic header works

        # Get actual image dimensions using PIL
        import io
        from PIL import Image
        pil_img = Image.open(io.BytesIO(image_content))
        img_width, img_height = pil_img.size

        # Step 1: Visual Analysis (Using Qwen-VL)
        print("Step 1: Analyzing image with Qwen-VL...")
        
        step1_prompt = """
请详细分析这张图片。
你需要识别画面中的主体、环境、光影、构图、视角、材质和细节特征。
请以JSON格式输出分析结果，包含以下字段：
- 图片尺寸 (Image Size): 自动读取 (请保留此字段)
- 场景基础 (Scene Basics): 天气, 时间, 光照, 视角
- 主体特征 (Subject Features): 建筑/物体形态, 材质, 颜色, 结构
- 视觉色彩 (Visual Colors): 主色调 (Dominant Colors), 配色方案 (Color Scheme)
- 环境细节 (Environment Details): 配景, 植被, 道路, 天空
- 风格氛围 (Style & Mood): 整体风格, 氛围感, 艺术参考
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
            
            # Inject actual dimensions if possible (simple string manipulation or JSON parsing)
            # Since generating valid JSON is hard to guarantee, we'll just prepend it textually if it's not a valid object,
            # or try to insert it if it looks like JSON.
            # Simple approach: Return a new JSON string combining real data + AI data
            
            return {
                "result": f"""{{
  "图片物理尺寸": "{img_width}x{img_height}",
  "AI分析内容": {cleaned_json if cleaned_json.startswith('{') else f'"{cleaned_json}"'}
}}"""
            }

        # Step 2: Prompt Generation
        print("Step 2: Generating final prompt...")
        
        if not user_request:
            user_request = "保持原图风格，优化细节质感"

        # Simplified System Prompt from User
        system_prompt = f"""# Role: 高级 AI 视觉架构师与提示词工程专家

## Core Mission:
你是一个专门为 NanoBanana (Gemini/Qwen 生图) 打造的提示词转换引擎。你的任务是接收“一张参考图”和“一段用户大白话”，通过后台逻辑建模，输出一段工业级、高精度的中文生图提示词。

基于上一步的【视觉分析】以及用户的【大白话需求】，生成最终的生图提示词。

## 用户大白话需求:
{user_request}

## 视觉分析结果:
{analysis_result}

## Output Requirements:
1. 必须是纯文本，不要包含 Markdown 代码块标记 (如 ```json 或 ```)。
2. 只输出最终的中文提示词内容，不要任何解释或前缀。
3. 必须严格遵循用户的【提示词要求】，将这些要求仅次于核心视觉还原进行融入。同时，必须保持除用户要求修改外的其余画面元素（如环境、风格、非修改主体）与原图高度统一。
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
        
        # Post-processing to clean up output (just in case)
        # Remove ```json ... ``` or ``` ... ```
        final_result = re.sub(r'```[a-zA-Z]*\n', '', final_result)
        final_result = re.sub(r'```', '', final_result)
        
        # Remove internal thought process/json objects if they leaked, matching balanced braces would be better but simple strict regex for common cases:
        # Match {"...": ...} roughly if it appears at start
        final_result = re.sub(r'^\s*\{.*?\}\s*', '', final_result, flags=re.DOTALL) 
        
        print(f"Final Result: {final_result[:100]}...")
        
        return {"result": final_result.strip()}

    except Exception as e:
        print(f"API Error: {str(e)}")
        # Return the specific error message to the frontend
        raise HTTPException(
            status_code=500, 
            detail=f"API调用失败: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8011, reload=True)
