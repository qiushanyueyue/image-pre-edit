# AI Smart Image Pre-processing & Prompt Optimizer (AI 图片预处理与提示词优化助手)

An intelligent tool designed for extensive image editing workflows. It combines local AI (Qwen-VL) with a modern React frontend to help users analyze images and generate strict, high-precision prompts for secondary creation (e.g., Stable Diffusion, Midjourney).

这是一个专为图片深度编辑工作流设计的智能助手。它结合了本地 AI (Qwen-VL) 和现代 React 前端，帮助用户分析图片并生成严格遵循指令的高精度提示词，用于二次创作（如 Stable Diffusion, Midjourney）。

## ✨ Features (核心功能)

- **🖼️ Visual Analysis (视觉分析)**
  - Automatically identifies image dimensions, dominant colors, and composition.
  - Generates detailed descriptions of scene, lighting, and subjects.
  - **Dual Mode**: Supports both raw analysis (for understanding) and prompt generation.

- **🎨 Smart Prompt Extension (智能提示词扩展)**
  - **Strict Adherence Mode**: The AI treats your input requirements as the **Highest Priority**, strictly following modifications (e.g., "Change to night scene") while preserving other visual elements.
  - **Detail Enhancement**: Automatically expands simple keywords into professional-grade descriptors (e.g., "Sci-fi" -> "Cyberpunk style, neon lighting, metallic texture").

- **⚡ Hybrid Architecture (混合架构)**
  - **Frontend**: React + TypeScript + Tailwind CSS (Responsive & Modern UI).
  - **Backend**: FastAPI (Python) serving as a bridge.
  - **AI Engine**: Connects to **local Ollama (Qwen-VL)** via DDNS tunnel, ensuring **Free & Unlimited** usage with privacy.

## 🛠️ Tech Stack (技术栈)

- **Frontend**: Vite, React 18, Zustand (State Management), Lucide React (Icons).
- **Backend**: Python 3.9+, FastAPI, OpenAI SDK (compatible with Ollama).
- **AI Model**: Qwen-VL (via Ollama).

## 🚀 Getting Started (本地运行)

### Prerequisites (前置准备)
1. Ensure you have Node.js and Python installed.
2. Ensure you have a running Ollama instance (or a tunnel to one) with `qwen3-vl`.

### Installation (安装步骤)

1. **Clone the repo**
   ```bash
   git clone https://github.com/qiushanyueyue/image-pre-edit.git
   cd image-pre-edit
   ```

2. **Setup Backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   # Create .env file with your API details
   # QWEN_VL_ENDPOINT=http://your-ollama-url/v1
   # QWEN_VL_API_KEY=ollama
   python main.py
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ☁️ Deployment (Vercel 部署)

This project is configured for seamless deployment on Vercel.

1. **Push to GitHub**.
2. **Import in Vercel**.
3. **Environment Variables**:
   Set `QWEN_VL_ENDPOINT` to your local tunnel URL (e.g., `http://yytianjin.yyboxdns.com:12524/v1`) in Vercel settings.
4. **Deploy**: Vercel will handle the React build and serverless Python backend.

## 📝 License

MIT License.
