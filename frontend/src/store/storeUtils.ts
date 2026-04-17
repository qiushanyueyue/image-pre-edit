import type { CanvasElement, OverlayImage } from './useStore';

interface HistorySnapshot {
    elements: CanvasElement[];
    imageUrl: string | null;
}

export interface ClearCanvasStateInput {
    imageUrl: string | null;
    overlays: OverlayImage[];
    jsonResult: string;
    history: HistorySnapshot[];
    historyIndex: number;
}

export const getClearedEditingState = (state: ClearCanvasStateInput) => ({
    imageUrl: state.imageUrl,
    overlays: state.overlays,
    jsonResult: state.jsonResult,
    elements: [] as CanvasElement[],
    history: [] as HistorySnapshot[],
    historyIndex: -1,
});
