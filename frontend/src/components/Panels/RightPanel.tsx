import React, { useState } from 'react';
import { Upload, FileJson, Check, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useStore';
import { clsx } from 'clsx';

export const RightPanel: React.FC = () => {

    // Helper to compress image if too large
    const compressImage = (blob: Blob, maxSizeMB: number = 4): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            if (blob.size <= maxSizeMB * 1024 * 1024) {
                resolve(blob);
                return;
            }

            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize logic: Max dimension 1920px
                const MAX_DIM = 1920;
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = (height * MAX_DIM) / width;
                        width = MAX_DIM;
                    } else {
                        width = (width * MAX_DIM) / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context failed'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.8 quality
                canvas.toBlob(
                    (newBlob) => {
                        if (newBlob) {
                            console.log(`Image compressed: ${(blob.size / 1024 / 1024).toFixed(2)}MB -> ${(newBlob.size / 1024 / 1024).toFixed(2)}MB`);
                            resolve(newBlob);
                        } else {
                            reject(new Error('Compression failed'));
                        }
                    },
                    'image/jpeg',
                    0.8
                );
            };

            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };

            img.src = url;
        });
    };
    const {
        imageUrl,
        overlays, addOverlay, removeOverlay,
        jsonResult, setJsonResult
    } = useAppStore();

    const [userPrompt, setUserPrompt] = useState<string>('');
    const [analyzingMode, setAnalyzingMode] = useState<'json' | 'prompt' | null>(null);
    const [copied, setCopied] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const processFiles = (files: FileList | null) => {
        if (files) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const url = URL.createObjectURL(file);
                    addOverlay({ url, x: 100, y: 100, width: 200, height: 200 });
                }
            });
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        processFiles(e.dataTransfer.files);
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(jsonResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAiAnalyze = async (mode: 'json' | 'prompt') => {
        if (!imageUrl) {
            alert('请先上传图片');
            return;
        }

        setAnalyzingMode(mode);
        try {
            // 获取图片blob
            const response = await fetch(imageUrl);
            let blob = await response.blob();

            // Client-side compression if > 3.5MB (Safe guard for Vercel 4.5MB limit)
            if (blob.size > 3.5 * 1024 * 1024) {
                try {
                    console.log('Image too large detection, compressing...');
                    blob = await compressImage(blob, 3.5);
                } catch (e) {
                    console.error('Compression failed, trying original', e);
                }
            }

            const formData = new FormData();
            formData.append('image', blob, 'image.jpg'); // Rename to .jpg as compression converts format
            formData.append('user_request', userPrompt); // User plain text request
            formData.append('mode', mode); // Pass mode to backend

            console.log(`正在调用 AI API (${mode})...`);

            const apiUrl = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api/ai-analyze`
                : '/api/ai-analyze';

            console.log(`Sending request to: ${apiUrl}`);

            const res = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('API错误响应:', errorText);
                throw new Error(`API错误: ${res.status} ${res.statusText} - ${errorText.slice(0, 50)}`);
            }

            const data = await res.json();
            console.log('AI返回数据:', data);

            // Directly set text result
            if (data.result) {
                setJsonResult(data.result);
            } else {
                setJsonResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
            }

        } catch (error: unknown) {
            console.error('AI分析失败:', error);
            const msg = error instanceof Error ? error.message : String(error);
            alert(`❌ AI分析失败: ${msg}\n\n如有问题，请检查网络或稍后重试。`);
        } finally {
            setAnalyzingMode(null);
        }
    };

    return (
        <div className="w-[340px] flex-none flex flex-col h-full bg-white border-l border-slate-200 p-3 gap-3 overflow-y-auto custom-scrollbar">

            {/* Multiple Overlays Upload & Management */}
            <section className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                    贴图管理 <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{overlays.length}</span>
                </h3>

                {/* Upload button */}
                {/* Upload button */}
                <div
                    className={clsx(
                        "flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-xl cursor-pointer transition-all mb-2",
                        isDragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-500 hover:bg-blue-50"
                    )}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('sticker-upload-input')?.click()}
                >
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <p className="text-xs text-slate-500">拖拽Or点击上传</p>
                    </div>
                    <input
                        id="sticker-upload-input"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                        accept="image/*"
                    />
                </div>

                {/* Overlay list */}
                {overlays.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {overlays.map((overlay) => (
                            <div key={overlay.id} className="group relative bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-2 hover:border-blue-300 transition-colors">
                                <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                                    <img src={overlay.url} alt="overlay" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-600 truncate">贴图 {overlay.id.slice(-8)}</p>
                                    <p className="text-[10px] text-slate-400">{overlay.width}×{overlay.height}</p>
                                </div>
                                <button
                                    onClick={() => removeOverlay(overlay.id)}
                                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* User Request Input */}
            <section className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 mb-2">
                    提示词要求
                </h3>
                <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className="w-full h-16 p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-600 resize-none placeholder:text-slate-400"
                    placeholder="e.g. 把这个场景变成晚上，加点霓虹灯..."
                />
            </section>

            {/* AI Action Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => handleAiAnalyze('json')}
                    disabled={analyzingMode !== null || !imageUrl}
                    className="flex-1 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {analyzingMode === 'json' ? <Loader2 className="animate-spin" size={16} /> : <FileJson size={16} />}
                    视觉分析 (JSON)
                </button>
                <button
                    onClick={() => handleAiAnalyze('prompt')}
                    disabled={analyzingMode !== null || !imageUrl}
                    className="flex-1 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {analyzingMode === 'prompt' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    扩展提示词
                </button>
            </div>

            {/* Editable Prompt Output */}
            {jsonResult ? (
                <section className="flex-1 flex flex-col min-h-0 bg-slate-50 rounded-2xl p-3 border border-slate-100 relative">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-500 flex items-center gap-2">
                            <FileJson size={14} /> 输出框
                        </h3>
                        <button
                            onClick={handleCopyJson}
                            className={clsx(
                                "px-2 py-1 rounded text-[10px] font-medium transition-colors border",
                                copied
                                    ? "bg-green-50 text-green-600 border-green-200"
                                    : "bg-white text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            )}
                        >
                            {copied ? <span className="flex items-center gap-1"><Check size={10} /> 已复制</span> : "复制结果"}
                        </button>
                    </div>
                    <textarea
                        value={jsonResult}
                        onChange={(e) => setJsonResult(e.target.value)}
                        className="flex-1 w-full p-3 font-mono text-[10px] text-slate-600 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 overflow-auto"
                        placeholder="生成的提示词将显示在这里，可直接编辑..."
                    />
                    <p className="text-[9px] text-slate-400 mt-2">💡 可实时编辑</p>
                </section>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Sparkles size={24} className="opacity-20" />
                    <p className="text-xs opacity-50">输入需求并点击生成</p>
                </div>
            )}

            {/* Debug Log Section - Removed for Production */}
        </div>
    );
};
