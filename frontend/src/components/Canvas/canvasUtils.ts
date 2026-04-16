export interface Point {
  x: number;
  y: number;
}

export interface RectShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_TEXT_WIDTH = 80;
const MIN_TEXT_HEIGHT = 36;
const MIN_TEXT_FONT_SIZE = 18;

export const normalizeRect = ({ x, y, width, height }: RectShape): RectShape => ({
  x: width >= 0 ? x : x + width,
  y: height >= 0 ? y : y + height,
  width: Math.abs(width),
  height: Math.abs(height),
});

export const isPointInsideImageBounds = (point: Point, bounds: RectShape): boolean => {
  const rect = normalizeRect(bounds);
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

export const getTextBoxLayout = ({ width, height }: Pick<RectShape, 'width' | 'height'>) => {
  const safeWidth = Math.max(MIN_TEXT_WIDTH, Math.abs(width));
  const safeHeight = Math.max(MIN_TEXT_HEIGHT, Math.abs(height));
  const fontSize = Math.max(MIN_TEXT_FONT_SIZE, Math.round(safeHeight / 2));

  return {
    width: safeWidth,
    height: safeHeight,
    fontSize,
  };
};
