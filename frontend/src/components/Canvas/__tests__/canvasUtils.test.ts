import { describe, expect, it } from 'vitest';
import { getTextBoxLayout, isPointInsideImageBounds, normalizeRect } from '../canvasUtils';

describe('isPointInsideImageBounds', () => {
  it('returns true when the pointer is inside the image bounds', () => {
    expect(
      isPointInsideImageBounds({ x: 120, y: 80 }, { x: 0, y: 0, width: 400, height: 300 }),
    ).toBe(true);
  });

  it('returns false when the pointer is outside the image bounds', () => {
    expect(
      isPointInsideImageBounds({ x: 420, y: 80 }, { x: 0, y: 0, width: 400, height: 300 }),
    ).toBe(false);
  });
});

describe('normalizeRect', () => {
  it('normalizes negative drag sizes into a positive rectangle', () => {
    expect(normalizeRect({ x: 200, y: 150, width: -90, height: -40 })).toEqual({
      x: 110,
      y: 110,
      width: 90,
      height: 40,
    });
  });
});

describe('getTextBoxLayout', () => {
  it('enforces minimum text box dimensions and a readable font size', () => {
    expect(getTextBoxLayout({ width: 12, height: 10 })).toEqual({
      width: 80,
      height: 36,
      fontSize: 18,
    });
  });

  it('scales font size with the resized text box height', () => {
    expect(getTextBoxLayout({ width: 240, height: 96 })).toEqual({
      width: 240,
      height: 96,
      fontSize: 48,
    });
  });
});
