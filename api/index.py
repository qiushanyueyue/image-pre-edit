from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import io
import json
import os
import sys
import traceback

CURRENT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from PIL import Image

from api.vision_client import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL_NAME,
    VisionModelClient,
    build_analysis_prompt,
    build_prompt_messages,
    clean_text_response,
    safe_json_loads,
)

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

vision_client = VisionModelClient.from_env()

@app.get("/api/health")
def health_check():
    return {
        "status": "ok", 
        "model": vision_client.model_name,
        "base_url": vision_client.base_url,
        "vision_target": vision_client.get_target_diagnostics(),
        "deps": {
            "pil": True
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
    
    data["env_vars"] = [k for k in os.environ.keys() if "VISION" in k or "VERCEL" in k]
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
    try:
        print(f"Received request: {user_request}, mode: {mode}")

        image_content = await image.read()
        pil_img = Image.open(io.BytesIO(image_content))
        img_width, img_height = pil_img.size

        analysis_prompt = build_analysis_prompt(img_width, img_height)
        analysis_text = await asyncio.to_thread(vision_client.generate, analysis_prompt, image_content)
        analysis_result = safe_json_loads(analysis_text, img_width, img_height)
        print(f"Analysis Result: {json.dumps(analysis_result, ensure_ascii=False)[:160]}...")

        if mode == "json":
            return {"result": json.dumps(analysis_result, ensure_ascii=False, indent=2)}

        messages = build_prompt_messages(analysis_result, user_request)
        prompt_text = f"{messages['system']}\n\n{messages['user']}"
        final_result = await asyncio.to_thread(vision_client.generate, prompt_text, None)

        return {"result": clean_text_response(final_result)}

    except Exception as e:
        print(f"Vision API Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"视觉分析服务错误: {str(e)} - Check Vercel Logs for traceback"
        )
