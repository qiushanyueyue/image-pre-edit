import React from 'react';
import { LeftPanel } from '../components/Panels/LeftPanel';
import { RightPanel } from '../components/Panels/RightPanel';
import { ImageCanvas } from '../components/Canvas/ImageCanvas';
import { useAppStore } from '../store/useStore';

export const MainLayout: React.FC = () => {
    // Enforce light theme visually (no toggle)
    useAppStore((state) => state.setImageUrl);

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
            {/* Header / Navbar */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
                    <span className="font-bold text-sm tracking-wide text-slate-700">图片预编辑工具</span>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <LeftPanel />
                <main className="flex-1 min-w-0 relative bg-slate-100 overflow-hidden flex flex-col items-center justify-center p-4">
                    <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl bg-white border border-slate-200">
                        <ImageCanvas />
                    </div>
                </main>
                <RightPanel />
            </div>
        </div>
    );
};
