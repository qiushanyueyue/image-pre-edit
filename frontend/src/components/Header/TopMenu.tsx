import React from 'react';
import { Download, FileJson, Undo2, Redo2 } from 'lucide-react';

import { useAppStore } from '../../store/useStore';

export const TopMenu: React.FC = () => {
    const { undo, redo, canUndo, canRedo, setCanvasAction, jsonResult } = useAppStore();

    const handleExportImage = () => {
        setCanvasAction('EXPORT_IMAGE');
    };

    const handleExportJSON = () => {
        if (!jsonResult) {
            alert('暂无分析结果可导出');
            return;
        }
        const blob = new Blob([jsonResult], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analysis.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUndo = () => {
        undo();
    };

    const handleRedo = () => {
        redo();
    };

    return (
        <div className="h-12 flex items-center justify-between px-4 bg-slate-800/50 dark:bg-slate-800/50 bg-white/50 border-b border-white/5 dark:border-white/5 border-gray-200">
            <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    图片预处理
                </h1>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={handleUndo}
                    disabled={!canUndo()}
                    className="p-2 rounded-lg text-slate-400 dark:text-slate-400 text-gray-600 hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="撤销 (Ctrl+Z)"
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={handleRedo}
                    disabled={!canRedo()}
                    className="p-2 rounded-lg text-slate-400 dark:text-slate-400 text-gray-600 hover:text-primary hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="重做 (Ctrl+Y)"
                >
                    <Redo2 size={18} />
                </button>

                <div className="w-px h-6 bg-white/10 dark:bg-white/10 bg-gray-200 mx-2" />

                <button
                    onClick={handleExportJSON}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700 hover:bg-white/5 transition-colors"
                >
                    <FileJson size={16} />
                    导出 JSON
                </button>
                <button
                    onClick={handleExportImage}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
                >
                    <Download size={16} />
                    导出图片
                </button>
            </div>
        </div>
    );
};
