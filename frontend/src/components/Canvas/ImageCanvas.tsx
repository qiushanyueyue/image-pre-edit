import { useRef, useState, useEffect, Fragment, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Arrow, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useAppStore, type CanvasElement, type OverlayImage } from '../../store/useStore';
import Konva from 'konva';
import { clsx } from 'clsx';
import { getTextBoxLayout, normalizeRect, shouldBlockArrowStart } from './canvasUtils';

// Multi-Overlay Component with Individual Transformers
interface OverlayImageComponentProps {
    overlay: OverlayImage;
    isSelected: boolean;
    onSelect: () => void;
    onChange: (id: string, updates: Partial<OverlayImage>) => void;
}

const OverlayImageComponent = ({ overlay, isSelected, onSelect, onChange }: OverlayImageComponentProps) => {
    const [image] = useImage(overlay.url);
    const shapeRef = useRef<Konva.Image>(null);
    const trRef = useRef<Konva.Transformer>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    return (
        <Fragment>
            <KonvaImage
                name="overlay-image"
                onClick={onSelect}
                onTap={onSelect}
                ref={shapeRef}
                image={image}
                draggable
                x={overlay.x}
                y={overlay.y}
                width={overlay.width}
                height={overlay.height}
                onDragEnd={(e) => {
                    onChange(overlay.id, {
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = shapeRef.current;
                    if (!node) return;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange(overlay.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 5 || newBox.height < 5) return oldBox;
                        return newBox;
                    }}
                />
            )}
        </Fragment>
    );
};

const URLImage = ({ src }: { src: string }) => {
    const [image] = useImage(src);

    return <KonvaImage name="background-image" image={image} />;
};

interface TextElementComponentProps {
    element: CanvasElement;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onChange: (id: string, updates: Record<string, number | string>) => void;
    onEdit: (id: string) => void;
    tool: string;
    setIsHoveringElement: (hovering: boolean) => void;
}

const TextElementComponent = ({
    element,
    isSelected,
    onSelect,
    onChange,
    onEdit,
    tool,
    setIsHoveringElement,
}: TextElementComponentProps) => {
    const textRef = useRef<Konva.Text>(null);
    const transformerRef = useRef<Konva.Transformer>(null);

    useEffect(() => {
        if (isSelected && textRef.current && transformerRef.current) {
            transformerRef.current.nodes([textRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected, element.width, element.height]);

    return (
        <Fragment>
            <Text
                ref={textRef}
                id={element.id ?? ''}
                x={element.x ?? 0}
                y={element.y ?? 0}
                width={element.width ?? 0}
                height={element.height ?? 0}
                padding={element.padding ?? 8}
                text={element.text ?? ''}
                fontSize={element.size ?? 20}
                fill={element.color ?? '#000000'}
                lineHeight={1.2}
                verticalAlign="middle"
                wrap="word"
                draggable
                name="canvas-text-element"
                onClick={(e) => {
                    if (tool === 'select' || tool === 'text') {
                        e.cancelBubble = true;
                        onSelect(element.id ?? '');
                    }
                }}
                onTap={(e) => {
                    if (tool === 'select' || tool === 'text') {
                        e.cancelBubble = true;
                        onSelect(element.id ?? '');
                    }
                }}
                onDblClick={() => onEdit(element.id ?? '')}
                onDblTap={() => onEdit(element.id ?? '')}
                onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = tool === 'hand' ? 'grab' : 'move';
                    setIsHoveringElement(true);
                }}
                onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = tool === 'text' ? 'text' : 'default';
                    setIsHoveringElement(false);
                }}
                onDragEnd={(e) => {
                    onChange(element.id ?? '', {
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = textRef.current;
                    if (!node) return;

                    const layout = getTextBoxLayout({
                        width: node.width() * node.scaleX(),
                        height: node.height() * node.scaleY(),
                    });

                    node.scaleX(1);
                    node.scaleY(1);

                    onChange(element.id ?? '', {
                        x: node.x(),
                        y: node.y(),
                        width: layout.width,
                        height: layout.height,
                        size: layout.fontSize,
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={transformerRef}
                    rotateEnabled={false}
                    borderDash={[6, 4]}
                    borderStroke="#3b82f6"
                    anchorStroke="#3b82f6"
                    anchorFill="#ffffff"
                    anchorCornerRadius={999}
                    anchorSize={8}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                        const layout = getTextBoxLayout({
                            width: newBox.width,
                            height: newBox.height,
                        });

                        if (!Number.isFinite(newBox.width) || !Number.isFinite(newBox.height)) {
                            return oldBox;
                        }

                        return {
                            ...newBox,
                            width: layout.width,
                            height: layout.height,
                        };
                    }}
                />
            )}
        </Fragment>
    );
};

export const ImageCanvas: React.FC = () => {
    const {
        tool, brushSize, brushColor, brushOpacity, fontSize,
        imageUrl, setImageUrl, overlays, updateOverlay, removeOverlay, pushHistory,
        elements, setElements
    } = useAppStore();

    const stageRef = useRef<Konva.Stage>(null);
    // Elements now managed by store
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDrawing = useRef(false);

    // Selection state
    const [selectedId, selectShape] = useState<string | null>(null);

    // Polyline/Polygon state
    const [polylinePoints, setPolylinePoints] = useState<number[]>([]);
    const [polygonPoints, setPolygonPoints] = useState<number[]>([]);

    // Crop state
    const [cropBox, setCropBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [isCropping, setIsCropping] = useState(false);

    const textDragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [draftTextBox, setDraftTextBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [textEditor, setTextEditor] = useState<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        color: string;
        fontSize: number;
        isNew: boolean;
    } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isCommittingTextRef = useRef(false);

    // Drag and drop upload
    const [isDragOver, setIsDragOver] = useState(false);

    // Hover state to prevent stage drag when over elements
    const [isHoveringElement, setIsHoveringElement] = useState(false);

    // Copy success state
    const [copySuccess, setCopySuccess] = useState(false);

    const getShapeSelectionHandlers = useCallback((elementId?: string) => ({
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (tool !== 'select' || !elementId) return;
            e.cancelBubble = true;
            selectShape(elementId);
        },
        onTap: (e: Konva.KonvaEventObject<TouchEvent>) => {
            if (tool !== 'select' || !elementId) return;
            e.cancelBubble = true;
            selectShape(elementId);
        },
    }), [tool]);

    const getShapeSelectionStyle = useCallback((elementId?: string) => {
        const isSelected = Boolean(elementId) && selectedId === elementId;

        return {
            shadowColor: isSelected ? '#3b82f6' : undefined,
            shadowBlur: isSelected ? 12 : 0,
            shadowOpacity: isSelected ? 0.75 : 0,
        };
    }, [selectedId]);

    function handleDownload() {
        const uri = stageRef.current?.toDataURL();
        if (uri) {
            const link = document.createElement('a');
            link.download = 'edited-image.png';
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    useEffect(() => {
        if (!textEditor || !textareaRef.current) return;

        textareaRef.current.focus();
        textareaRef.current.select();
    }, [textEditor]);

    const checkDeselect = (e: Konva.KonvaEventObject<MouseEvent> | Konva.KonvaEventObject<TouchEvent>) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectShape(null);
        }
    };

    const updateElementById = (id: string, updates: Record<string, number | string>, shouldPushHistory = true) => {
        const newElements = elements.map((element) => (
            element.id === id ? { ...element, ...updates } : element
        ));
        setElements(newElements);
        if (shouldPushHistory) {
            pushHistory({ elements: newElements });
        }
    };

    const removeElementById = useCallback((id: string) => {
        const newElements = elements.filter((element) => element.id !== id);
        setElements(newElements);
        pushHistory({ elements: newElements });
    }, [elements, pushHistory, setElements]);

    const deleteSelectedContent = useCallback(() => {
        if (!selectedId) return;

        const selectedElement = elements.find((element) => element.id === selectedId);
        if (selectedElement) {
            removeElementById(selectedId);
            selectShape(null);
            return;
        }

        const selectedOverlay = overlays.find((overlay) => overlay.id === selectedId);
        if (selectedOverlay) {
            removeOverlay(selectedId);
            selectShape(null);
        }
    }, [elements, overlays, removeElementById, removeOverlay, selectedId]);

    // Listen for TopMenu / LeftPanel actions
    const { canvasAction, setCanvasAction } = useAppStore();
    useEffect(() => {
        if (canvasAction === 'EXPORT_IMAGE') {
            handleDownload();
            setCanvasAction('NONE');
            return;
        }
        if (canvasAction === 'DELETE_SELECTED') {
            const frameId = window.requestAnimationFrame(() => {
                deleteSelectedContent();
                setCanvasAction('NONE');
            });
            return () => window.cancelAnimationFrame(frameId);
        }
    }, [canvasAction, deleteSelectedContent, setCanvasAction]);

    const openTextEditor = (config: {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        color: string;
        fontSize: number;
        isNew: boolean;
    }) => {
        setTextEditor(config);
        selectShape(config.id);
    };

    const commitTextEditor = useCallback((shouldSave = true) => {
        if (!textEditor || isCommittingTextRef.current) return;
        isCommittingTextRef.current = true;

        const trimmed = textEditor.text.trim();
        if (!shouldSave || !trimmed) {
            if (!textEditor.isNew && !trimmed) {
                removeElementById(textEditor.id);
            }
            setTextEditor(null);
            setDraftTextBox(null);
            textDragStartRef.current = null;
            window.setTimeout(() => {
                isCommittingTextRef.current = false;
            }, 0);
            return;
        }

        const updatedElement: CanvasElement = {
            id: textEditor.id,
            tool: 'text',
            x: textEditor.x,
            y: textEditor.y,
            width: textEditor.width,
            height: textEditor.height,
            text: textEditor.text,
            color: textEditor.color,
            size: textEditor.fontSize,
            padding: 8,
            draggable: true,
        };

        const newElements = textEditor.isNew
            ? [...elements, updatedElement]
            : elements.map((element) => (element.id === textEditor.id ? { ...element, ...updatedElement } : element));

        setElements(newElements);
        pushHistory({ elements: newElements });
        setTextEditor(null);
        setDraftTextBox(null);
        textDragStartRef.current = null;
        window.setTimeout(() => {
            isCommittingTextRef.current = false;
        }, 0);
    }, [elements, pushHistory, removeElementById, setElements, textEditor]);

    const openExistingTextEditor = (id: string) => {
        const textElement = elements.find((element) => element.id === id && element.tool === 'text');
        if (!textElement) return;

        setDraftTextBox(null);
        openTextEditor({
            id: textElement.id ?? id,
            x: textElement.x ?? 0,
            y: textElement.y ?? 0,
            width: textElement.width ?? 180,
            height: textElement.height ?? 56,
            text: textElement.text ?? '',
            color: textElement.color ?? brushColor,
            fontSize: textElement.size ?? fontSize,
            isNew: false,
        });
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const scaleBy = 1.1;
        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        if (newScale < 0.1 || newScale > 5) return;
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        setScale(newScale);
        setPosition(newPos);
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        console.log('Canvas handleMouseDown, tool:', tool);
        if (textEditor) {
            commitTextEditor();
            return;
        }
        checkDeselect(e);
        if (tool === 'hand' || tool === 'select') return;

        const stage = stageRef.current;
        const pos = stage?.getRelativePointerPosition();
        if (!pos) return;

        // Crop tool
        if (tool === 'crop') {
            setCropBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
            setIsCropping(true);
            return;
        }

        // Polyline/Polygon tools
        if (tool === 'polyline') {
            setPolylinePoints([...polylinePoints, pos.x, pos.y]);
            return;
        }
        if (tool === 'polygon') {
            setPolygonPoints([...polygonPoints, pos.x, pos.y]);
            return;
        }

        if (tool === 'text') {
            const targetName = e.target.className;
            if (targetName === 'Text' || targetName === 'Transformer') return;
            textDragStartRef.current = { x: pos.x, y: pos.y };
            setDraftTextBox({
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
            });
            return;
        }

        // Line Tool - Drag to create line
        if (tool === 'line') {
            setElements([...elements, {
                id: `line-${Date.now()}`,
                tool: 'line',
                points: [pos.x, pos.y, pos.x, pos.y],
                color: brushColor,
                strokeWidth: brushSize,
                opacity: brushOpacity
            }]);
            isDrawing.current = true;
            return;
        }

        isDrawing.current = true;

        if (tool === 'brush' || tool === 'eraser') {
            setElements([...elements, {
                id: `${tool}-${Date.now()}`,
                tool,
                points: [pos.x, pos.y],
                color: brushColor,
                size: brushSize,
                opacity: brushOpacity
            }]);
        } else if (tool === 'rectangle' || tool === 'circle' || tool === 'arrow') {
            const targetName = typeof e.target.name === 'function' ? e.target.name() : '';
            if (tool === 'arrow' && shouldBlockArrowStart(targetName)) {
                isDrawing.current = false;
                return;
            }
            setElements([...elements, {
                id: `${tool}-${Date.now()}`,
                tool,
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                points: [pos.x, pos.y, pos.x, pos.y],
                color: brushColor,
                strokeWidth: brushSize, // Use brushSize for stroke
                opacity: brushOpacity
            }]);
        }
    };

    const handleMouseMove = () => {
        const stage = stageRef.current;
        const point = stage?.getRelativePointerPosition();
        if (!point) return;

        if (tool === 'text' && draftTextBox && textDragStartRef.current) {
            setDraftTextBox({
                x: textDragStartRef.current.x,
                y: textDragStartRef.current.y,
                width: point.x - textDragStartRef.current.x,
                height: point.y - textDragStartRef.current.y,
            });
            return;
        }

        if (!isDrawing.current && !isCropping) return;
        if (tool === 'hand' || tool === 'select' || tool === 'text' || tool === 'polyline' || tool === 'polygon') return;

        // Update crop box while dragging
        if (isCropping && cropBox) {
            console.log('Updating crop box:', point.x - cropBox.x, point.y - cropBox.y);
            setCropBox({
                ...cropBox,
                width: point.x - cropBox.x,
                height: point.y - cropBox.y
            });
            return;
        }

        // Create a shallow copy of the elements array
        const newElements = [...elements];
        const lastIndex = newElements.length - 1;
        const lastElement = { ...newElements[lastIndex] };

        if (tool === 'brush' || tool === 'eraser') {
            lastElement.points = (lastElement.points ?? []).concat([point.x, point.y]);
        } else if (tool === 'rectangle' || tool === 'circle') {
            lastElement.width = point.x - (lastElement.x ?? 0);
            lastElement.height = point.y - (lastElement.y ?? 0);
        } else if (tool === 'arrow' || tool === 'line') {
            const startPoints = lastElement.points ?? [point.x, point.y];
            lastElement.points = [startPoints[0], startPoints[1], point.x, point.y];
        }

        newElements[lastIndex] = lastElement;
        setElements(newElements);
    };

    const handleMouseUp = () => {
        if (tool === 'text' && draftTextBox && textDragStartRef.current) {
            const normalizedBox = normalizeRect(draftTextBox);
            const hasDragged = Math.abs(draftTextBox.width) > 8 || Math.abs(draftTextBox.height) > 8;
            const layout = hasDragged
                ? getTextBoxLayout(normalizedBox)
                : getTextBoxLayout({ width: 180, height: fontSize * 2.6 });
            const origin = hasDragged
                ? { x: normalizedBox.x, y: normalizedBox.y }
                : { x: textDragStartRef.current.x, y: textDragStartRef.current.y };

            openTextEditor({
                id: `text-${Date.now()}`,
                x: origin.x,
                y: origin.y,
                width: layout.width,
                height: layout.height,
                text: '',
                color: brushColor,
                fontSize: hasDragged ? layout.fontSize : Math.max(fontSize, layout.fontSize),
                isNew: true,
            });
            setDraftTextBox({
                x: origin.x,
                y: origin.y,
                width: layout.width,
                height: layout.height,
            });
            textDragStartRef.current = null;
            return;
        }

        if (isDrawing.current) {
            pushHistory({ elements: [...elements] });
        }
        isDrawing.current = false;
        setIsCropping(false);
    };

    const executeCrop = () => {
        if (!cropBox || !stageRef.current) return;

        const stage = stageRef.current;

        // Finalize crop box coordinates (handle negative width/height)
        const x = cropBox.width > 0 ? cropBox.x : cropBox.x + cropBox.width;
        const y = cropBox.height > 0 ? cropBox.y : cropBox.y + cropBox.height;
        const width = Math.abs(cropBox.width);
        const height = Math.abs(cropBox.height);

        // Coordinates for toDataURL on Stage should be in stage coordinates (affected by scale/pos)
        // BUT if we use a specific layer or node, it might be easier.
        // Konva's toDataURL x/y are in screen coordinates relative to stage top-left.
        const croppedDataUrl = stage.toDataURL({
            x: (x * scale) + position.x,
            y: (y * scale) + position.y,
            width: width * scale,
            height: height * scale,
            pixelRatio: 2
        });

        setImageUrl(croppedDataUrl);
        setCropBox(null);
        setElements([]);
        pushHistory({ imageUrl: croppedDataUrl, elements: [] });
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageUrl(URL.createObjectURL(file));
            pushHistory({ imageUrl: URL.createObjectURL(file) });
        }
    };

    const handleCopyImage = async () => {
        const uri = stageRef.current?.toDataURL();
        if (uri) {
            try {
                const blob = await (await fetch(uri)).blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        }
    };

    // Drag and Drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files[0]) {
            setImageUrl(URL.createObjectURL(files[0]));
            pushHistory({ imageUrl: URL.createObjectURL(files[0]) });
        }
    };

    // Finalize polyline
    const finalizePolyline = useCallback(() => {
        if (polylinePoints.length >= 4) {
            const polylineElement: CanvasElement = {
                id: `polyline-${Date.now()}`,
                tool: 'polyline',
                points: polylinePoints,
                color: brushColor,
                strokeWidth: brushSize,
                opacity: brushOpacity
            };
            const newElements = [...elements, polylineElement];
            setElements(newElements);
            pushHistory({ elements: newElements });
        }
        setPolylinePoints([]);
    }, [brushColor, brushOpacity, brushSize, elements, polylinePoints, pushHistory, setElements]);

    // Finalize polygon (close and fill)
    const finalizePolygon = useCallback(() => {
        if (polygonPoints.length >= 6) { // At least 3 points
            const polygonElement: CanvasElement = {
                id: `polygon-${Date.now()}`,
                tool: 'polygon',
                points: polygonPoints,
                color: brushColor,
                fill: brushColor,
                opacity: brushOpacity,
                closed: true
            };
            const newElements = [...elements, polygonElement];
            setElements(newElements);
            pushHistory({ elements: newElements });
        }
        setPolygonPoints([]);
    }, [brushColor, brushOpacity, elements, polygonPoints, pushHistory, setElements]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 多段线使用空格键完成
            if (tool === 'polyline' && e.key === ' ') {
                e.preventDefault();
                finalizePolyline();
            }
            // 多边形使用空格键闭合填充
            if (tool === 'polygon' && e.key === ' ') {
                e.preventDefault();
                finalizePolygon();
            }
            // Escape 取消当前绘制
            if (e.key === 'Escape') {
                if (textEditor) {
                    commitTextEditor(false);
                }
                setPolylinePoints([]);
                setPolygonPoints([]);
                setCropBox(null);
                setDraftTextBox(null);
                selectShape(null);
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && !textEditor && selectedId) {
                const activeTag = (document.activeElement?.tagName ?? '').toLowerCase();
                if (activeTag === 'input' || activeTag === 'textarea') {
                    return;
                }

                const selectedElement = elements.find((element) => element.id === selectedId);
                if (selectedElement) {
                    e.preventDefault();
                    deleteSelectedContent();
                    return;
                }

                const selectedOverlay = overlays.find((overlay) => overlay.id === selectedId);
                if (selectedOverlay) {
                    e.preventDefault();
                    deleteSelectedContent();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tool, elements, overlays, textEditor, selectedId, commitTextEditor, finalizePolyline, finalizePolygon, deleteSelectedContent]);

    // Container sizing
    const containerRef = useRef<HTMLDivElement>(null);
    const [stageDimensions, setStageDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const updateDimensions = () => {
            if (containerRef.current) {
                setStageDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        // Initial size
        updateDimensions();

        const observer = new ResizeObserver(updateDimensions);
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);


    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-white cursor-crosshair overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {imageUrl ? (
                <>
                    <Stage
                        ref={stageRef}
                        width={stageDimensions.width}
                        height={stageDimensions.height}
                        onMouseDown={handleMouseDown}
                        onMousemove={handleMouseMove}
                        onMouseup={handleMouseUp}
                        onWheel={handleWheel}
                        scaleX={scale}
                        scaleY={scale}
                        x={position.x}
                        y={position.y}
                        draggable={tool === 'hand' && !isHoveringElement}
                        onDragEnd={(e) => {
                            // Update React state to match Konva's internal drag position
                            // Only update if it was the stage that dragged
                            if (e.target === e.target.getStage()) {
                                setPosition({
                                    x: e.target.x(),
                                    y: e.target.y()
                                });
                            }
                        }}
                    >
                        {/* Background Image Layer - Separate so Eraser doesn't affect it */}
                        <Layer>
                            <URLImage src={imageUrl} />
                        </Layer>

                        {/* Drawings Layer - Eraser (destination-out) only clears this layer */}

                        {/* Overlay Layer (Logos/Stickers) - Rendered FIRST so it is BELOW drawings */}
                        <Layer>
                            {overlays.map((overlay) => (
                                <OverlayImageComponent
                                    key={overlay.id}
                                    overlay={overlay}
                                    isSelected={selectedId === overlay.id}
                                    onSelect={() => {
                                        if (tool === 'select') selectShape(overlay.id);
                                    }}
                                    onChange={updateOverlay}
                                />
                            ))}
                        </Layer>

                        {/* Drawings Layer - Rendered AFTER stickers so it is ON TOP */}
                        <Layer>
                            {/* Drawings on the same layer as image so eraser (destination-out) works on background */}
                            {elements.map((el, i) => {
                                if (el.tool === 'brush' || el.tool === 'eraser') {
                                    return (
                                        <Line
                                            key={el.id ?? i}
                                            points={el.points}
                                            stroke={el.tool === 'eraser' ? '#000000' : el.color}
                                            strokeWidth={el.size}
                                            tension={0.5}
                                            lineCap="round"
                                            lineJoin="round"
                                            opacity={el.opacity}
                                            globalCompositeOperation={
                                                el.tool === 'eraser' ? 'destination-out' : 'source-over'
                                            }
                                            hitStrokeWidth={Math.max((el.size ?? 1) + 12, 18)}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'rectangle') {
                                    return (
                                        <Rect
                                            key={el.id ?? i}
                                            x={el.x ?? 0}
                                            y={el.y ?? 0}
                                            width={el.width ?? 0}
                                            height={el.height ?? 0}
                                            stroke={el.color ?? '#000000'}
                                            strokeWidth={el.strokeWidth ?? 1}
                                            opacity={el.opacity}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'circle') {
                                    return (
                                        <Circle
                                            key={el.id ?? i}
                                            x={(el.x ?? 0) + (el.width ?? 0) / 2}
                                            y={(el.y ?? 0) + (el.height ?? 0) / 2}
                                            radius={Math.abs(((el.width ?? 0) + (el.height ?? 0)) / 4)}
                                            stroke={el.color ?? '#000000'}
                                            strokeWidth={el.strokeWidth ?? 1}
                                            opacity={el.opacity}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'arrow') {
                                    return (
                                        <Arrow
                                            key={el.id ?? i}
                                            points={el.points ?? []}
                                            stroke={el.color ?? '#000000'}
                                            strokeWidth={el.strokeWidth ?? 1}
                                            fill={el.color ?? '#000000'}
                                            opacity={el.opacity}
                                            hitStrokeWidth={Math.max((el.strokeWidth ?? 1) + 12, 18)}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'line') {
                                    return (
                                        <Line
                                            key={el.id ?? i}
                                            points={el.points ?? []}
                                            stroke={el.color ?? '#000000'}
                                            strokeWidth={el.strokeWidth ?? 1}
                                            opacity={el.opacity}
                                            lineCap="round"
                                            hitStrokeWidth={Math.max((el.strokeWidth ?? 1) + 12, 18)}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'polyline') {
                                    return (
                                        <Line
                                            key={el.id ?? i}
                                            points={el.points ?? []}
                                            stroke={el.color ?? '#000000'}
                                            strokeWidth={el.strokeWidth ?? 1}
                                            opacity={el.opacity}
                                            lineCap="round"
                                            lineJoin="round"
                                            hitStrokeWidth={Math.max((el.strokeWidth ?? 1) + 12, 18)}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'polygon') {
                                    return (
                                        <Line
                                            key={el.id ?? i}
                                            points={el.points ?? []}
                                            stroke={el.color ?? '#000000'}
                                            fill={el.color ?? '#000000'}
                                            strokeWidth={2}
                                            opacity={el.opacity}
                                            closed={true}
                                            hitStrokeWidth={18}
                                            {...getShapeSelectionHandlers(el.id)}
                                            {...getShapeSelectionStyle(el.id)}
                                        />
                                    );
                                } else if (el.tool === 'text') {
                                    return (
                                        <TextElementComponent
                                            key={el.id ?? i}
                                            element={el}
                                            isSelected={selectedId === el.id}
                                            onSelect={selectShape}
                                            onChange={updateElementById}
                                            onEdit={openExistingTextEditor}
                                            tool={tool}
                                            setIsHoveringElement={setIsHoveringElement}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </Layer>

                        {/* Preview/Utility Layer (Not erased) */}
                        <Layer>{/* Live Polyline preview */}
                            {tool === 'polyline' && polylinePoints.length >= 2 && (
                                <>
                                    <Line
                                        points={polylinePoints}
                                        stroke={brushColor}
                                        strokeWidth={Math.max(brushSize, 4)}
                                        opacity={1.0}
                                    />
                                    {/* Node highlights */}
                                    {polylinePoints.map((_, i) => {
                                        if (i % 2 === 0) {
                                            return (
                                                <Fragment key={`node-${i}`}>
                                                    <Circle
                                                        x={polylinePoints[i]}
                                                        y={polylinePoints[i + 1]}
                                                        radius={9}
                                                        fill="#3b82f6"
                                                        opacity={0.2}
                                                        listening={false}
                                                    />
                                                    <Circle
                                                        x={polylinePoints[i]}
                                                        y={polylinePoints[i + 1]}
                                                        radius={6}
                                                        fill="#3b82f6"
                                                        stroke="#ffffff"
                                                        strokeWidth={3}
                                                    />
                                                </Fragment>
                                            );
                                        }
                                        return null;
                                    })}
                                </>
                            )}

                            {/* Live Polygon preview */}
                            {tool === 'polygon' && polygonPoints.length >= 2 && (
                                <>
                                    <Line
                                        points={polygonPoints}
                                        stroke={brushColor}
                                        fill={brushColor}
                                        opacity={0.3}
                                        closed={false}
                                        dash={[10, 6]}
                                        strokeWidth={Math.max(brushSize, 4)}
                                    />
                                    {polygonPoints.map((_, i) => {
                                        if (i % 2 === 0) {
                                            return (
                                                <Fragment key={`poly-node-${i}`}>
                                                    <Circle
                                                        x={polygonPoints[i]}
                                                        y={polygonPoints[i + 1]}
                                                        radius={11}
                                                        fill="#10b981"
                                                        opacity={0.24}
                                                        listening={false}
                                                    />
                                                    <Circle
                                                        x={polygonPoints[i]}
                                                        y={polygonPoints[i + 1]}
                                                        radius={7}
                                                        fill="#10b981"
                                                        stroke="#ffffff"
                                                        strokeWidth={3}
                                                    />
                                                </Fragment>
                                            );
                                        }
                                        return null;
                                    })}
                                </>
                            )}

                            {/* Crop box */}
                            {tool === 'crop' && cropBox && (
                                <>
                                    <Rect
                                        x={-10000}
                                        y={-10000}
                                        width={20000}
                                        height={20000}
                                        fill="black"
                                        opacity={0.5}
                                        listening={false}
                                    />
                                    <Rect
                                        x={cropBox.x}
                                        y={cropBox.y}
                                        width={cropBox.width}
                                        height={cropBox.height}
                                        fill="white"
                                        globalCompositeOperation="destination-out"
                                        listening={false}
                                    />
                                    <Rect
                                        x={cropBox.x}
                                        y={cropBox.y}
                                        width={cropBox.width}
                                        height={cropBox.height}
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        dash={[10, 5]}
                                    />
                                </>
                            )}

                            {!textEditor && draftTextBox && (
                                <Rect
                                    x={draftTextBox.x}
                                    y={draftTextBox.y}
                                    width={draftTextBox.width}
                                    height={draftTextBox.height}
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    dash={[6, 4]}
                                />
                            )}
                        </Layer>
                    </Stage>

                    {/* Floating Bottom Bar */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 py-2 px-6 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-2xl z-50">
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                        >
                            下载图片
                        </button>
                        <button
                            onClick={handleCopyImage}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-full text-sm font-medium transition-all active:scale-95 relative"
                        >
                            复制图片
                            {copySuccess && (
                                <span className="ml-2 text-green-600 font-semibold">✓ 已复制</span>
                            )}
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-2" />
                        <div className="flex items-center gap-2">
                            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100">-</button>
                            <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100">+</button>
                        </div>
                    </div>

                    {/* Tool hints */}
                    {cropBox && tool === 'crop' && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[100]">
                            <span className="text-sm">拖拽调整裁剪区域</span>
                            <button onClick={executeCrop} className="px-3 py-1 bg-white text-blue-600 rounded-md text-sm font-medium">执行裁剪</button>
                            <button onClick={() => setCropBox(null)} className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm">取消</button>
                        </div>
                    )}
                    {(tool === 'polyline' && polylinePoints.length > 0) && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-xl z-[100] animate-bounce-subtle">
                            点击添加节点 | 按 空格键 完成 | Esc 取消
                        </div>
                    )}
                    {(tool === 'polygon' && polygonPoints.length > 0) && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-[100]">
                            点击添加节点 | 按 空格键 闭合填充 | Esc 取消
                        </div>
                    )}

                    {/* Drag overlay hint */}
                    {isDragOver && (
                        <div className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 rounded-2xl flex items-center justify-center backdrop-blur-sm z-[100]">
                            <div className="bg-white px-6 py-4 rounded-xl shadow-2xl">
                                <p className="text-lg font-bold text-blue-600">松开鼠标上传图片</p>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div
                    className="flex flex-col items-center justify-center h-full gap-4"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className={clsx(
                        "w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mb-2 shadow-inner transition-all",
                        isDragOver && "border-4 border-dashed border-blue-500 bg-blue-50 scale-110"
                    )}>
                        <div className="w-16 h-16 bg-slate-200 rounded-xl animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">拖拽图片到此处</h3>
                    <p className="text-slate-500 text-sm">支持 JPG, PNG, WebP (Max 50MB)</p>
                    <label className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xl shadow-blue-500/20 cursor-pointer font-medium transition-all hover:scale-105 active:scale-95">
                        或选择本地文件
                        <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
                    </label>
                </div>
            )}

            {textEditor && (
                <textarea
                    ref={textareaRef}
                    spellCheck={false}
                    value={textEditor.text}
                    onChange={(e) => setTextEditor({ ...textEditor, text: e.target.value })}
                    onBlur={() => commitTextEditor()}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            commitTextEditor(false);
                        }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            commitTextEditor();
                        }
                    }}
                    className="absolute z-[120] resize-none rounded-md border-2 border-dashed border-blue-500 bg-transparent px-2 py-1 shadow-none outline-none"
                    style={{
                        left: textEditor.x * scale + position.x,
                        top: textEditor.y * scale + position.y,
                        width: textEditor.width * scale,
                        height: textEditor.height * scale,
                        fontSize: textEditor.fontSize * scale,
                        lineHeight: 1.2,
                        color: textEditor.color,
                        caretColor: textEditor.color,
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        fontFamily: 'inherit',
                        fontWeight: 500,
                        WebkitTextFillColor: textEditor.color,
                        padding: `${Math.max(4, 8 * scale)}px`,
                    }}
                />
            )}
        </div>
    );
};
