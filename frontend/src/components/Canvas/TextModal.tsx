import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface TextModalProps {
    isOpen: boolean;
    initialText: string;
    onConfirm: (text: string) => void;
    onClose: () => void;
    title?: string;
}

export const TextModal: React.FC<TextModalProps> = ({
    isOpen,
    initialText,
    onConfirm,
    onClose,
    title = '输入文本'
}) => {
    const [text, setText] = useState(initialText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setText(initialText);
            // Autofocus after a short delay to ensure render
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.select();
                }
            }, 50);
        }
    }, [isOpen, initialText]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (text.trim()) {
            onConfirm(text);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl w-80 p-4 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-700">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full h-32 p-3 text-sm bg-transparent border-0 rounded-lg focus:outline-none focus:ring-0 resize-none mb-4 text-slate-700 placeholder:text-slate-400"
                    placeholder="请输入文本..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirm();
                        }
                    }}
                />

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1 transition-colors shadow-sm shadow-blue-500/30"
                    >
                        <Check size={14} />
                        确定
                    </button>
                </div>
            </div>
        </div>
    );
};
