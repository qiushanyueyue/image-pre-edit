import React, { useState } from 'react';
import { useAppStore } from '../../store/useStore';

const PRESET_COLORS = [
    '#3b82f6', // Primary Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#000000', // Black
    '#ffffff', // White
];

export const ColorPicker: React.FC = () => {
    const { brushColor, setBrushColor } = useAppStore();
    const [showPicker, setShowPicker] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 flex-1">
                    <div
                        className="w-6 h-6 rounded border-2 border-white/20"
                        style={{ backgroundColor: brushColor }}
                    />
                    <span className="text-sm text-slate-300 dark:text-slate-300 text-gray-700">颜色</span>
                </div>
            </button>

            {showPicker && (
                <div className="absolute left-full ml-2 top-0 bg-slate-800 dark:bg-slate-800 bg-white border border-white/10 dark:border-white/10 border-gray-200 rounded-xl p-3 shadow-xl z-50 min-w-[200px]">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => {
                                        setBrushColor(color);
                                        setShowPicker(false);
                                    }}
                                    className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: color === brushColor ? '#3b82f6' : 'transparent',
                                    }}
                                    title={color}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="w-full h-8 rounded cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
