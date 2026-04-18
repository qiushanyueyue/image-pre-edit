import { describe, expect, it } from 'vitest';
import { getClearedEditingState } from './storeUtils';

describe('getClearedEditingState', () => {
    it('clears the base image, overlays, json, and edited elements together', () => {
        const state = getClearedEditingState();

        expect(state.imageUrl).toBeNull();
        expect(state.overlays).toEqual([]);
        expect(state.jsonResult).toBe('');
        expect(state.elements).toEqual([]);
        expect(state.history).toEqual([]);
        expect(state.historyIndex).toBe(-1);
    });
});
