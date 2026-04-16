# 图片预编辑器修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复箭头起点、文本框编辑、视觉分析模型与可反推中文 JSON 输出，并保证可部署到 GitHub 与 Vercel。

**Architecture:** 保持现有 React + Konva + FastAPI 架构不变，前端对箭头与文本引入明确对象模型与可测试工具函数，后端将视觉分析改为调用配置化 HTTP 模型服务并统一输出结构化中文 JSON。线上入口以 `api/index.py` 为准，本地入口 `backend/main.py` 同步保持一致。

**Tech Stack:** React 19, TypeScript, Vite, Konva, Zustand, FastAPI, Python 3, requests/unittest

---

### Task 1: 建立测试与辅助函数骨架

**Files:**
- Create: `frontend/src/components/Canvas/canvasUtils.ts`
- Create: `frontend/src/components/Canvas/__tests__/canvasUtils.test.ts`
- Modify: `frontend/package.json`

**Step 1: Write the failing test**

- 为以下行为写测试：
  - 命中底图区域时，箭头不允许起笔。
  - 命中底图区域外时，箭头允许起笔。
  - 文本框尺寸变化后，字体大小与最小宽高限制生效。

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runInBand`
Expected: FAIL because test runner or helper file is missing.

**Step 3: Write minimal implementation**

- 添加 Vitest 配置与测试脚本。
- 在 `canvasUtils.ts` 中实现纯函数：
  - `isPointInsideImageBounds`
  - `normalizeRect`
  - `getTextBoxLayout`

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/package.json frontend/src/components/Canvas/canvasUtils.ts frontend/src/components/Canvas/__tests__/canvasUtils.test.ts
git commit -m "test: add canvas interaction utility coverage"
```

### Task 2: 后端模型客户端与 JSON 结构

**Files:**
- Create: `api/vision_client.py`
- Create: `api/tests/test_vision_client.py`
- Modify: `api/index.py`
- Modify: `backend/main.py`
- Modify: `requirements.txt`
- Modify: `backend/requirements.txt`

**Step 1: Write the failing test**

- 为以下行为写测试：
  - HTTP 模型返回 JSON 代码块时，能清洗为合法中文 JSON。
  - 缺少必要字段时，会补齐空字段与推荐提示词。
  - 根据结构化分析与用户要求，能生成文本提示词请求体。

**Step 2: Run test to verify it fails**

Run: `python -m unittest api.tests.test_vision_client -v`
Expected: FAIL because helper module is missing.

**Step 3: Write minimal implementation**

- 提取模型 HTTP 调用与 JSON 清洗逻辑到 `vision_client.py`。
- 让 `api/index.py` 与 `backend/main.py` 都走新客户端。
- 切换默认模型和地址到 `gemma4:e4b` / `http://yytianjin.yyboxdns.com:12524/`。

**Step 4: Run test to verify it passes**

Run: `python -m unittest api.tests.test_vision_client -v`
Expected: PASS

**Step 5: Commit**

```bash
git add api/vision_client.py api/tests/test_vision_client.py api/index.py backend/main.py requirements.txt backend/requirements.txt
git commit -m "feat: switch vision analysis to gemma endpoint"
```

### Task 3: 文本框原位编辑与箭头起点限制

**Files:**
- Modify: `frontend/src/components/Canvas/ImageCanvas.tsx`
- Modify: `frontend/src/store/useStore.ts`
- Delete: `frontend/src/components/Canvas/TextModal.tsx`

**Step 1: Write the failing test**

- 补充或扩展前端测试，覆盖文本框默认尺寸、缩放约束、矩形归一化逻辑。

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runInBand`
Expected: FAIL with new assertions.

**Step 3: Write minimal implementation**

- 删除弹窗文本输入逻辑。
- 增加文本框拖拽创建、原位编辑、选中变形、二次编辑能力。
- 箭头在底图内按下时直接拒绝创建对象。
- 更新 history 逻辑，保证文字尺寸/位置变化可撤销。

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/Canvas/ImageCanvas.tsx frontend/src/store/useStore.ts
git rm frontend/src/components/Canvas/TextModal.tsx
git commit -m "feat: improve canvas text editing and arrow constraints"
```

### Task 4: 文档与部署验证

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`
- Modify: `DEPLOYMENT.md`

**Step 1: Update docs**

- 把 Gemini 配置说明替换为新模型 HTTP 服务配置。
- 说明 JSON 输出定位为可反推文生图描述。

**Step 2: Run verification**

Run:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npm test -- --runInBand`
- `python -m unittest api.tests.test_vision_client -v`

Expected: all PASS

**Step 3: Commit**

```bash
git add README.md backend/.env.example DEPLOYMENT.md
git commit -m "docs: update deployment and vision model configuration"
```
