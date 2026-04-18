import type { CanvasElement, OverlayImage } from './useStore';

interface HistorySnapshot {
    elements: CanvasElement[];
    imageUrl: string | null;
}

export const getClearedEditingState = () => ({
    imageUrl: null,
    overlays: [] as OverlayImage[],
    jsonResult: '',
    elements: [] as CanvasElement[],
    history: [] as HistorySnapshot[],
    historyIndex: -1,
});
