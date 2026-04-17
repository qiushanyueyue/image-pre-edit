import { describe, expect, it } from 'vitest';
import { getClearedEditingState } from './storeUtils';

describe('getClearedEditingState', () => {
    it('preserves the base image, overlays, and json while clearing edited elements', () => {
        const state = getClearedEditingState({
            imageUrl: 'blob:base-image',
            overlays: [
                { id: 'overlay-1', url: 'blob:overlay', x: 10, y: 20, width: 100, height: 100 },
            ],
            jsonResult: '{"ok":true}',
            history: [{ elements: [{ id: 'rect-1', tool: 'rectangle' }], imageUrl: 'blob:base-image' }],
            historyIndex: 0,
        });

        expect(state.imageUrl).toBe('blob:base-image');
        expect(state.overlays).toHaveLength(1);
        expect(state.jsonResult).toBe('{"ok":true}');
        expect(state.elements).toEqual([]);
        expect(state.history).toEqual([]);
        expect(state.historyIndex).toBe(-1);
    });
});
