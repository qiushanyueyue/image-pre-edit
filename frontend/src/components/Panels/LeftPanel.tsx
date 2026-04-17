import React from 'react';
import { useAppStore, type ToolType } from '../../store/useStore';
import {
    type LucideIcon,
    MousePointer2,
    Hand,
    Crop,
    Eraser,
    Square,
    Circle,
    Type,
    Minus,
    Pentagon as Polygon,
    Undo2,
    Redo2,
    MoveUpRight,
    Plus,
    Trash2,
    Activity,
    Brush,
    Copy
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

// Extracted ToolButton for stability and performance
const ToolButton = ({ t, icon: Icon, label, onClick, isActive, disabled }: {
    t: ToolType | 'crop' | 'undo' | 'redo' | 'delete' | 'clear',
    icon: LucideIcon,
    label: string,
    onClick?: () => void,
    isActive: boolean,
    disabled?: boolean
}) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={clsx(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-all gap-1 aspect-square",
                isActive
                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                    : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-700",
                disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "",
                (t === 'clear' || t === 'delete') ? "text-red-500 hover:bg-red-50 hover:text-red-600" : ""
            )}
            title={label}
        >
            <Icon size={18} />
            <span className="text-[9px] font-medium leading-none scale-90">{label}</span>
        </button>
    );
};

export const LeftPanel = () => {
    const {
        tool,
        setTool,
        brushSize,
        setBrushSize,
        fontSize,
        setFontSize,
        brushColor,
        setBrushColor,
        brushOpacity,
        setBrushOpacity,
        undo,
        redo,
        canUndo,
        canRedo,
        clearCanvas,
        setCanvasAction,
        prompts,
        addPrompt,
        removePrompt,
        updatePromptAt // Import updatePromptAt
    } = useAppStore();

    const [newPrompt, setNewPrompt] = useState('');

    const tools: { t: ToolType | 'crop', icon: LucideIcon, label: string }[] = [
        { t: 'select', icon: MousePointer2, label: '选择' },
        { t: 'hand', icon: Hand, label: '拖动' },
        { t: 'crop', icon: Crop, label: '裁剪' },
        { t: 'brush', icon: Brush, label: '画笔' },
        { t: 'eraser', icon: Eraser, label: '橡皮擦' },
        { t: 'rectangle', icon: Square, label: '矩形' },
        { t: 'circle', icon: Circle, label: '圆形' },
        { t: 'arrow', icon: MoveUpRight, label: '箭头' },
        { t: 'text', icon: Type, label: '文本' },
        { t: 'polyline', icon: Activity, label: '折线' },
        { t: 'polygon', icon: Polygon, label: '填充' },
        { t: 'line', icon: Minus, label: '直线' },
    ];

    const historyTools: { t: 'undo' | 'redo' | 'delete' | 'clear', icon: LucideIcon, label: string }[] = [
        { t: 'undo', icon: Undo2, label: '撤销' },
        { t: 'redo', icon: Redo2, label: '重做' },
        { t: 'delete', icon: Trash2, label: '删除' },
        { t: 'clear', icon: Eraser, label: '清空' },
    ];

    const handleToolClick = (t: ToolType | 'crop' | 'undo' | 'redo' | 'delete' | 'clear') => {
        if (t === 'undo') {
            undo();
        } else if (t === 'redo') {
            redo();
        } else if (t === 'delete') {
            setCanvasAction('DELETE_SELECTED');
        } else if (t === 'clear') {
            if (window.confirm('确定要清空当前标注吗？参考图和分析结果会保留。')) {
                clearCanvas();
            }
        } else {
            console.log('LeftPanel switching tool to:', t);
            setTool(t as ToolType);
        }
    };

    const handleAddPrompt = () => {
        if (newPrompt.trim()) {
            addPrompt(newPrompt.trim());
            setNewPrompt('');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="w-72 flex-none h-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 flex flex-col py-3 gap-2 overflow-y-auto select-none pointer-events-auto">
            {/* Tools Grid */}
            <div className="px-4">
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">常用工具</div>
                <div className="grid grid-cols-4 gap-1">
                    {tools.map((item) => (
                        <ToolButton
                            key={item.t}
                            {...item}
                            isActive={tool === item.t}
                            onClick={() => handleToolClick(item.t)}
                        />
                    ))}
                </div>
            </div>

            <div className="h-px bg-slate-100 mx-4" />

            {/* History Control & Clear */}
            <div className="px-4">
                <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">操作</div>
                <div className="grid grid-cols-4 gap-1">
                    {historyTools.map((item) => (
                        <ToolButton
                            key={item.t}
                            {...item}
                            isActive={false} // History buttons have no active state
                            disabled={(item.t === 'undo' && !canUndo()) || (item.t === 'redo' && !canRedo())}
                            onClick={() => handleToolClick(item.t)}
                        />
                    ))}
                </div>
            </div>


            {/* Property Controls */}
            {(tool === 'brush' || tool === 'eraser' || tool === 'rectangle' || tool === 'circle' || tool === 'line' || tool === 'arrow' || tool === 'polyline' || tool === 'polygon' || tool === 'text') && (
                <>
                    <div className="h-px bg-slate-100 mx-4" />
                    <div className="px-4 space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">属性设置</div>

                        {/* Color Picker */}
                        {tool !== 'eraser' && (
                            <div className="space-y-1">
                                <label className="text-xs text-slate-500">颜色</label>
                                <div className="flex flex-wrap gap-2">
                                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#000000', '#ffffff'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setBrushColor(c)}
                                            className={clsx(
                                                "w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110",
                                                brushColor === c ? "ring-2 ring-blue-500 ring-offset-2" : ""
                                            )}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={brushColor}
                                        onChange={(e) => setBrushColor(e.target.value)}
                                        className="w-6 h-6 rounded-full overflow-hidden border-0 p-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Size Slider */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>{tool === 'text' ? '字体大小' : '大小'}</span>
                                <span>{tool === 'text' ? fontSize : brushSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max={['brush', 'eraser', 'text'].includes(tool) ? "300" : "100"}
                                value={tool === 'text' ? fontSize : brushSize}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (tool === 'text') {
                                        setFontSize(val);
                                    } else {
                                        setBrushSize(val);
                                    }
                                }}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Opacity Slider */}
                        {tool !== 'eraser' && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span>不透明度</span>
                                    <span>{Math.round(brushOpacity * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.1"
                                    value={brushOpacity}
                                    onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Prompt Management (Moved to Bottom, mt-auto removed) */}
            <div className="">
                <div className="h-px bg-slate-100 mx-4" />
                <div className="px-4 space-y-2 py-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">提示词</div>

                    {/* Add Prompt Input */}
                    <div className="flex gap-1">
                        <input
                            type="text"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="输入新提示词..."
                            className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
                        />
                        <button
                            onClick={handleAddPrompt}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Prompt List (Compact & Editable) */}
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                        {prompts.map((p, idx) => (
                            <div key={idx} className="group flex items-center gap-1 text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                                <input
                                    type="text"
                                    value={p}
                                    onChange={(e) => updatePromptAt(idx, e.target.value)}
                                    className="flex-1 bg-transparent border-0 outline-none min-w-0 text-slate-600 focus:text-blue-600"
                                />
                                <button
                                    onClick={() => copyToClipboard(p)}
                                    className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="复制"
                                >
                                    <Copy size={12} />
                                </button>
                                <button
                                    onClick={() => removePrompt(p)}
                                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="删除"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {prompts.length === 0 && (
                            <p className="text-[10px] text-slate-400 text-center py-2">暂无提示词</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
