import { useRef, useState, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Arrow, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useAppStore } from '../../store/useStore';
import Konva from 'konva';
import { clsx } from 'clsx';
import { TextModal } from './TextModal';

// Multi-Overlay Component with Individual Transformers
const OverlayImageComponent = ({ overlay, isSelected, onSelect, onChange }: any) => {
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
    return <KonvaImage image={image} />;
};

export const ImageCanvas: React.FC = () => {
    const {
        tool, brushSize, brushColor, brushOpacity, fontSize,
        imageUrl, setImageUrl, overlays, updateOverlay, pushHistory,
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

    // Text Modal state
    const [textModal, setTextModal] = useState<{
        isOpen: boolean,
        x: number,
        y: number,
        text: string,
        id?: string // If id exists, it's editing; otherwise, it's new
    }>({ isOpen: false, x: 0, y: 0, text: '' });

    // Drag and drop upload
    const [isDragOver, setIsDragOver] = useState(false);

    // Hover state to prevent stage drag when over elements
    const [isHoveringElement, setIsHoveringElement] = useState(false);

    // Copy success state
    const [copySuccess, setCopySuccess] = useState(false);

    // Listen for TopMenu actions
    const { canvasAction, setCanvasAction } = useAppStore();
    useEffect(() => {
        if (canvasAction === 'EXPORT_IMAGE') {
            handleDownload();
            setCanvasAction('NONE');
        }
    }, [canvasAction, setCanvasAction]);

    const checkDeselect = (e: Konva.KonvaEventObject<MouseEvent> | Konva.KonvaEventObject<TouchEvent>) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectShape(null);
        }
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

        // Text Tool - Click to Open Modal
        if (tool === 'text') {
            if (!stage) return;
            // Allow adding text on top of images/shapes, but not if clicking existing text (which triggers edit)
            // or transformer handles
            const targetName = e.target.className;
            if (targetName === 'Text' || targetName === 'Transformer') return;
            // Only adding new text if clicking on empty space (not dragging existing)

            setTextModal({
                isOpen: true,
                x: pos.x,
                y: pos.y,
                text: '',
                id: undefined
            });
            return;
        }

        // Line Tool - Drag to create line
        if (tool === 'line') {
            setElements([...elements, {
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
                tool,
                points: [pos.x, pos.y],
                color: brushColor,
                size: brushSize,
                opacity: brushOpacity
            }]);
        } else if (tool === 'rectangle' || tool === 'circle' || tool === 'arrow') {
            setElements([...elements, {
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

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isDrawing.current && !isCropping) return;
        if (tool === 'hand' || tool === 'select' || tool === 'text' || tool === 'polyline' || tool === 'polygon') return;

        const stage = stageRef.current;
        const point = stage?.getRelativePointerPosition();
        if (!point) return;

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
        let lastElement = { ...newElements[lastIndex] };

        if (tool === 'brush' || tool === 'eraser') {
            lastElement.points = lastElement.points.concat([point.x, point.y]);
        } else if (tool === 'rectangle' || tool === 'circle') {
            lastElement.width = point.x - lastElement.x;
            lastElement.height = point.y - lastElement.y;
        } else if (tool === 'arrow' || tool === 'line') {
            lastElement.points = [lastElement.points[0], lastElement.points[1], point.x, point.y];
        }

        newElements[lastIndex] = lastElement;
        setElements(newElements);
    };

    const handleMouseUp = () => {
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

    const handleDownload = () => {
        const uri = stageRef.current?.toDataURL();
        if (uri) {
            const link = document.createElement('a');
            link.download = 'edited-image.png';
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
    const finalizePolyline = () => {
        if (polylinePoints.length >= 4) {
            setElements([...elements, {
                tool: 'polyline',
                points: polylinePoints,
                color: brushColor,
                strokeWidth: brushSize,
                opacity: brushOpacity
            }]);
            pushHistory({ elements: [...elements] });
        }
        setPolylinePoints([]);
    };

    // Finalize polygon (close and fill)
    const finalizePolygon = () => {
        if (polygonPoints.length >= 6) { // At least 3 points
            setElements([...elements, {
                tool: 'polygon',
                points: polygonPoints,
                color: brushColor,
                fill: brushColor,
                opacity: brushOpacity,
                closed: true
            }]);
            pushHistory({ elements: [...elements] });
        }
        setPolygonPoints([]);
    };

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
                setPolylinePoints([]);
                setPolygonPoints([]);
                setCropBox(null);
                selectShape(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tool, polylinePoints, polygonPoints, brushColor, brushSize, brushOpacity, elements]);

    // Handle text double-click (Edit)
    const handleTextDblClick = (id: string, currentText: string) => {
        setTextModal({
            isOpen: true,
            x: 0, // Ignored for edit, usually
            y: 0,
            text: currentText,
            id: id
        });
    };

    // Handle Modal Confirm
    const handleTextConfirm = (text: string) => {
        if (textModal.id) {
            // Update existing
            setElements(elements.map(el =>
                el.id === textModal.id ? { ...el, text: text } : el
            ));
            pushHistory({ elements: [...elements] }); // History tracks full state, but we need fresh elements reference
        } else {
            // Create new
            const newId = `text-${Date.now()}`;
            const newElements = [...elements, {
                id: newId,
                tool: 'text',
                x: textModal.x,
                y: textModal.y,
                text,
                color: brushColor,
                size: fontSize,
                draggable: true
            }];
            setElements(newElements);
            pushHistory({ elements: newElements });
        }
        setTextModal({ ...textModal, isOpen: false });
    };

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
                        <Layer>
                            {/* Drawings on the same layer as image so eraser (destination-out) works on background */}
                            {elements.map((el, i) => {
                                if (el.tool === 'brush' || el.tool === 'eraser') {
                                    return (
                                        <Line
                                            key={i}
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
                                        />
                                    );
                                } else if (el.tool === 'rectangle') {
                                    return (
                                        <Rect
                                            key={i}
                                            x={el.x}
                                            y={el.y}
                                            width={el.width}
                                            height={el.height}
                                            stroke={el.color}
                                            strokeWidth={el.strokeWidth}
                                            opacity={el.opacity}
                                        />
                                    );
                                } else if (el.tool === 'circle') {
                                    return (
                                        <Circle
                                            key={i}
                                            x={el.x + el.width / 2}
                                            y={el.y + el.height / 2}
                                            radius={Math.abs((el.width + el.height) / 4)}
                                            stroke={el.color}
                                            strokeWidth={el.strokeWidth}
                                            opacity={el.opacity}
                                        />
                                    );
                                } else if (el.tool === 'arrow') {
                                    return (
                                        <Arrow
                                            key={i}
                                            points={el.points}
                                            stroke={el.color}
                                            strokeWidth={el.strokeWidth}
                                            fill={el.color}
                                            opacity={el.opacity}
                                        />
                                    );
                                } else if (el.tool === 'line') {
                                    return (
                                        <Line
                                            key={i}
                                            points={el.points}
                                            stroke={el.color}
                                            strokeWidth={el.strokeWidth}
                                            opacity={el.opacity}
                                            lineCap="round"
                                        />
                                    );
                                } else if (el.tool === 'polyline') {
                                    return (
                                        <Line
                                            key={i}
                                            points={el.points}
                                            stroke={el.color}
                                            strokeWidth={el.strokeWidth}
                                            opacity={el.opacity}
                                            lineCap="round"
                                            lineJoin="round"
                                        />
                                    );
                                } else if (el.tool === 'polygon') {
                                    return (
                                        <Line
                                            key={i}
                                            points={el.points}
                                            stroke={el.color}
                                            fill={el.color}
                                            strokeWidth={2}
                                            opacity={el.opacity}
                                            closed={true}
                                        />
                                    );
                                } else if (el.tool === 'text') {
                                    return (
                                        <Text
                                            key={i}
                                            id={el.id}
                                            x={el.x}
                                            y={el.y}
                                            text={el.text}
                                            fontSize={el.size}
                                            fill={el.color}
                                            draggable={true}
                                            onDblClick={() => handleTextDblClick(el.id, el.text)}
                                            onClick={(e) => {
                                                if (tool === 'text') {
                                                    e.cancelBubble = true;
                                                    handleTextDblClick(el.id, el.text);
                                                }
                                            }}
                                            onTap={(e) => {
                                                if (tool === 'text') {
                                                    e.cancelBubble = true;
                                                    handleTextDblClick(el.id, el.text);
                                                }
                                            }}
                                            onMouseEnter={(e) => {
                                                const container = e.target.getStage()?.container();
                                                if (container) container.style.cursor = 'move';
                                                setIsHoveringElement(true);
                                            }}
                                            onMouseLeave={(e) => {
                                                const container = e.target.getStage()?.container();
                                                if (container) container.style.cursor = tool === 'text' ? 'text' : 'default'; // Return to appropriate cursor
                                                setIsHoveringElement(false);
                                            }}
                                            onDragEnd={(e) => {
                                                const newElements = [...elements];
                                                newElements[i] = { ...el, x: e.target.x(), y: e.target.y() };
                                                setElements(newElements);
                                                pushHistory({ elements: newElements });
                                            }}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </Layer>

                        {/* Overlay Layer (Logos/Stickers) */}
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

                        {/* Preview/Utility Layer (Not erased) */}
                        <Layer>{/* Live Polyline preview */}
                            {tool === 'polyline' && polylinePoints.length >= 2 && (
                                <>
                                    <Line
                                        points={polylinePoints}
                                        stroke={brushColor}
                                        strokeWidth={brushSize}
                                        opacity={1.0}
                                    />
                                    {/* Node highlights */}
                                    {polylinePoints.map((_, i) => {
                                        if (i % 2 === 0) {
                                            return (
                                                <Circle
                                                    key={`node-${i}`}
                                                    x={polylinePoints[i]}
                                                    y={polylinePoints[i + 1]}
                                                    radius={5}
                                                    fill="#3b82f6"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                />
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
                                        dash={[5, 5]}
                                    />
                                    {polygonPoints.map((_, i) => {
                                        if (i % 2 === 0) {
                                            return (
                                                <Circle
                                                    key={`poly-node-${i}`}
                                                    x={polygonPoints[i]}
                                                    y={polygonPoints[i + 1]}
                                                    radius={5}
                                                    fill="#10b981"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                />
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

            <TextModal
                isOpen={textModal.isOpen}
                initialText={textModal.text}
                title={textModal.id ? '编辑文本' : '添加文本'}
                onConfirm={handleTextConfirm}
                onClose={() => setTextModal({ ...textModal, isOpen: false })}
            />
        </div>
    );
};
