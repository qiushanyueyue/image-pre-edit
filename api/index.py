"""
Vercel Serverless Function Entry Point
将 FastAPI 应用暴露给 Vercel
"""
import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from backend.main import app

# Vercel 需要的 handler
handler = app
