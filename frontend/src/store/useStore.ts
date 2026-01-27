import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ToolType = 'select' | 'hand' | 'brush' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'polyline' | 'polygon' | 'line' | 'crop';
type Theme = 'dark' | 'light';

export interface OverlayImage {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface AppState {
    tool: ToolType;
    brushSize: number;
    fontSize: number;
    brushColor: string;
    brushOpacity: number;
    imageUrl: string | null;
    overlays: OverlayImage[];
    prompts: string[];
    theme: Theme;

    jsonResult: string;
    setJsonResult: (json: string) => void;

    // History management
    history: any[];
    historyIndex: number;
    maxHistorySize: number;

    setTool: (tool: ToolType) => void;
    setTheme: (theme: Theme) => void;
    setBrushSize: (size: number) => void;
    setFontSize: (size: number) => void;
    setBrushColor: (color: string) => void;
    setBrushOpacity: (opacity: number) => void;
    setImageUrl: (url: string | null) => void;
    setElements: (elements: any[]) => void;
    clearCanvas: () => void;
    elements: any[];

    // Overlay management
    addOverlay: (overlay: Omit<OverlayImage, 'id'>) => void;
    updateOverlay: (id: string, updates: Partial<OverlayImage>) => void;
    removeOverlay: (id: string) => void;

    // Prompt management
    addPrompt: (prompt: string) => void;
    updatePrompt: (oldPrompt: string, newPrompt: string) => void;
    updatePromptAt: (index: number, newPrompt: string) => void;
    removePrompt: (prompt: string) => void;

    canvasAction: 'NONE' | 'EXPORT_IMAGE';
    setCanvasAction: (action: 'NONE' | 'EXPORT_IMAGE') => void;

    // History management
    pushHistory: (state: any) => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            tool: 'hand',
            brushSize: 20,
            fontSize: 20,
            brushColor: '#3b82f6',
            brushOpacity: 1,
            imageUrl: null,
            elements: [],
            overlays: [],
            jsonResult: '', // Default empty
            prompts: [
                '保持角度和建筑轮廓不变',
                '根据标记进行设计',
                '去掉所有的标记',
                '4K 超高清、增强清晰度和锐度、补充真实细节',
                '去掉参考图'
            ],
            theme: 'light',



            history: [],
            historyIndex: -1,
            maxHistorySize: 50,

            setTool: (tool) => {
                console.log('Setting tool to:', tool);
                set({ tool });
            },
            setTheme: (theme) => set({ theme }),
            setBrushSize: (brushSize) => set({ brushSize }),
            setFontSize: (fontSize) => set({ fontSize }),
            setBrushColor: (brushColor) => set({ brushColor }),
            setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),
            setImageUrl: (imageUrl) => set({ imageUrl, jsonResult: '', tool: 'hand' }),
            setElements: (elements) => set({ elements }),
            setJsonResult: (jsonResult) => set({ jsonResult }),

            canvasAction: 'NONE',
            setCanvasAction: (action) => set({ canvasAction: action }),

            clearCanvas: () => set({
                imageUrl: null,
                elements: [],
                overlays: [],
                jsonResult: '', // Clear JSON
                // Do NOT reset prompts as they are user collection
                history: [],
                historyIndex: -1
            }),

            addOverlay: (overlay) => set((state) => ({
                overlays: [...state.overlays, { ...overlay, id: `overlay-${Date.now()}-${Math.random()}` }]
            })),

            updateOverlay: (id, updates) => set((state) => ({
                overlays: state.overlays.map(o => o.id === id ? { ...o, ...updates } : o)
            })),

            removeOverlay: (id) => set((state) => ({
                overlays: state.overlays.filter(o => o.id !== id)
            })),

            addPrompt: (prompt) => set((state) => ({
                prompts: [...state.prompts, prompt]
            })),

            updatePrompt: (oldPrompt, newPrompt) => set((state) => ({
                prompts: state.prompts.map(p => p === oldPrompt ? newPrompt : p)
            })),

            updatePromptAt: (index, newPrompt) => set((state) => ({
                prompts: state.prompts.map((p, i) => i === index ? newPrompt : p)
            })),

            removePrompt: (prompt) => set((state) => ({
                prompts: state.prompts.filter(p => p !== prompt)
            })),

            pushHistory: (partialState) => set((state) => {
                // Create a full snapshot by merging current state with the partial update
                const snapshot = {
                    elements: state.elements,
                    imageUrl: state.imageUrl,
                    ...partialState
                };

                const newHistory = state.history.slice(0, state.historyIndex + 1);
                newHistory.push(snapshot);

                // Limit history size
                if (newHistory.length > state.maxHistorySize) {
                    newHistory.shift();
                    return {
                        history: newHistory,
                        historyIndex: newHistory.length - 1
                    };
                }

                return {
                    history: newHistory,
                    historyIndex: newHistory.length - 1
                };
            }),

            undo: () => {
                const state = get();
                if (state.historyIndex > 0) {
                    const newIndex = state.historyIndex - 1;
                    const prevState = state.history[newIndex];
                    set({
                        elements: prevState.elements || [],
                        imageUrl: prevState.imageUrl,
                        historyIndex: newIndex
                    });
                } else if (state.historyIndex === 0) {
                    const newIndex = -1;
                    set({
                        elements: [],
                        imageUrl: null,
                        historyIndex: newIndex
                    });
                }
            },

            redo: () => {
                const state = get();
                if (state.historyIndex < state.history.length - 1) {
                    const newIndex = state.historyIndex + 1;
                    const nextState = state.history[newIndex];
                    set({
                        elements: nextState.elements || [],
                        imageUrl: nextState.imageUrl,
                        historyIndex: newIndex
                    });
                }
            },

            canUndo: () => get().historyIndex >= 0,
            canRedo: () => get().historyIndex < get().history.length - 1,
        }),
        {
            name: 'ai-image-editor-storage',
            partialize: (state) => ({
                prompts: state.prompts,
                brushSize: state.brushSize,
                fontSize: state.fontSize,
                brushColor: state.brushColor,
                brushOpacity: state.brushOpacity,
                tool: state.tool,
                theme: state.theme,
                jsonResult: state.jsonResult
            }),
            version: 1,
            onRehydrateStorage: (state) => {
                console.log('hydration starts', state);
                return (state, error) => {
                    if (error) {
                        console.log('an error happened during hydration', error);
                    } else {
                        console.log('hydration finished', state);
                    }
                };
            },
        }
    )
);
