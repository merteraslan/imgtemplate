'use client';

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  ChangeEvent,
  FocusEvent
} from 'react';
import { Card } from '@/components/ui/card';
import {
  Image as ImageIcon,
  Type,
  Download,
  Trash,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Copy,
  FileImage,
  Lock,
  Unlock
} from 'lucide-react';

// ---------------------------------------------------------------------------
// BoundingBox Component
// If a custom bbox is passed (for text layers), it uses that for drawing.
const BoundingBox = React.memo(
  ({
    layer,
    onResizeStart,
    bbox
  }: {
    layer: any;
    onResizeStart: any;
    bbox?: { x: number; y: number; width: number; height: number };
  }) => {
    const handleMouseDown = (e: React.MouseEvent, pos: string) => {
      e.preventDefault();
      e.stopPropagation();
      onResizeStart(e, layer, pos);
    };

    const box = bbox || {
      x: layer.x,
      y: layer.y,
      width: layer.width || 100,
      height: layer.height || 40
    };

    return (
      <g>
        <rect
          x={box.x - 2}
          y={box.y - 2}
          width={box.width + 4}
          height={box.height + 4}
          fill="none"
          stroke="#00F"
          strokeWidth="1"
          strokeDasharray="4"
        />
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((pos) => (
          <circle
            key={pos}
            cx={
              box.x +
              (pos.includes('e')
                ? box.width
                : pos.includes('w')
                ? 0
                : box.width / 2)
            }
            cy={
              box.y +
              (pos.includes('s')
                ? box.height
                : pos.includes('n')
                ? 0
                : box.height / 2)
            }
            r="4"
            fill="#00F"
            style={{ cursor: `${pos}-resize`, userSelect: 'none' }}
            onMouseDown={(e) => handleMouseDown(e, pos)}
          />
        ))}
      </g>
    );
  }
);
BoundingBox.displayName = 'BoundingBox';

// ---------------------------------------------------------------------------
// TextLayer Component
// Renders the text and measures its actual bounding box using getBBox()
// If background is enabled, the parent preview renders a background rect behind the text.
const TextLayer = ({
  layer,
  onDragStart,
  updateBBox
}: {
  layer: any;
  onDragStart: (e: React.MouseEvent, layer: any) => void;
  updateBBox: (id: string, bbox: { x: number; y: number; width: number; height: number }) => void;
}) => {
  const textRef = useRef<SVGTextElement>(null);

  useLayoutEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox();
      updateBBox(layer.id, bbox);
    }
  }, [layer.text, layer.font, layer.size, layer.x, layer.y, layer.italic, layer.bold]);

  return (
    <text
      ref={textRef}
      x={Math.round(layer.x)}
      // Adjust y so the text baseline is roughly centered vertically
      y={Math.round(layer.y + layer.height * 0.7)}
      fontFamily={layer.font}
      fontSize={layer.size}
      fill={layer.color}
      style={{
        cursor: 'move',
        userSelect: 'none',
        fontStyle: layer.italic ? 'italic' : 'normal',
        fontWeight: layer.bold ? 'bold' : 'normal'
      }}
      opacity={layer.opacity ?? 1}
      onMouseDown={(e) => {
        e.preventDefault();
        onDragStart(e, layer);
      }}
    >
      {layer.text}
    </text>
  );
};

// ---------------------------------------------------------------------------
// resizeImage function remains unchanged
const resizeImage = (
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1200;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION;
            width = MAX_DIMENSION;
          } else {
            width = (width / height) * MAX_DIMENSION;
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve({ dataUrl, width, height });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ---------------------------------------------------------------------------
// Preset options for canvas sizes
const canvasPresets = [
  { label: 'Custom', value: '' },
  { label: 'Instagram Post (1080 x 1080)', value: '1080x1080' },
  { label: 'Instagram Story (1080 x 1920)', value: '1080x1920' },
  { label: 'Twitter Post (1200 x 675)', value: '1200x675' },
  { label: 'Facebook Post (1200 x 630)', value: '1200x630' }
];

// Helper function to generate unique layer names
const getUniqueLayerName = (prevLayers: any[], type: string): string => {
  const base = type === 'text' ? 'New Text' : 'New Image';
  const names = prevLayers.map((l) => l.name);
  if (!names.includes(base)) return base;
  let index = 2;
  while (names.includes(`${base} ${index}`)) {
    index++;
  }
  return `${base} ${index}`;
};

interface TemplateEditorProps {
  jsonData?: any;
  renderOnly?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ jsonData, renderOnly }) => {
  // ---------------------------------------------------------------------------
  // Canvas Settings – starting as an Instagram post
  const [canvasWidth, setCanvasWidth] = useState<number>(1080);
  const [canvasHeight, setCanvasHeight] = useState<number>(1080);
  const [canvasWidthInput, setCanvasWidthInput] = useState<string>('1080');
  const [canvasHeightInput, setCanvasHeightInput] = useState<string>('1080');
  const [preset, setPreset] = useState<string>('1080x1080');

  // Zoom state for preview pane – start zoomed out to avoid scrollbars
  const [zoom, setZoom] = useState<number>(0.5);

  // ---------------------------------------------------------------------------
  // Sample project state for an Instagram post.
  // The background layer is pushed to the bottom and uses the provided Unsplash URL.
  const [layers, setLayers] = useState<any>(jsonData?.layers || [
    {
      id: 'layer_2',
      type: 'text',
      name: 'Title',
      text: 'Sample Title',
      font: 'Helvetica',
      size: 60,
      color: '#333333',
      x: 50,
      y: 50,
      width: 980,
      height: 100,
      visible: true,
      opacity: 1,
      bold: true,
      italic: false,
      useBackground: true,
      backgroundColor: '#ffffff',
      bgPadding: 8,
      borderWidth: 2,
      borderColor: '#333333',
      lockAspectRatio: true
    },
    {
      id: 'layer_4',
      type: 'text',
      name: 'Caption',
      text: 'This is a caption',
      font: 'Times New Roman',
      size: 72,
      color: '#00f004',
      x: 79,
      y: 816,
      width: 202,
      height: 16,
      visible: true,
      opacity: 1,
      italic: true,
      bold: false,
      useBackground: true,
      backgroundColor: '#850061',
      bgPadding: 8,
      borderWidth: 0,
      borderColor: '#666666',
      lockAspectRatio: true
    },
    {
      id: 'layer_3',
      type: 'image',
      name: 'Sample Image',
      useColorFill: true,
      fillColor: '#c38cca',
      x: 50,
      y: 200,
      width: 980,
      height: 600,
      visible: true,
      opacity: 1,
      borderWidth: 3,
      borderColor: '#ffffff',
      src: '',
      lockAspectRatio: true
    },
    {
      id: 'layer_1',
      type: 'image',
      name: 'Background',
      useColorFill: false,
      fillColor: '#e0e0e0',
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      visible: true,
      opacity: 1,
      borderWidth: 0,
      borderColor: '#000000',
      // Use the provided background image URL
      src: 'https://unsplash.com/photos/kLOuJrm-Wnk/download?ixid=M3wxMjA3fDB8MXxhbGx8MTB8fHx8fHx8fDE3MzkyNDI5Mzd8&force=true&w=1920.png',
      lockAspectRatio: true
    }
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const selectedLayer = layers.find((l: any) => l.id === selectedLayerId);

  // New state for aligning with another layer
  const [alignTargetLayerId, setAlignTargetLayerId] = useState<string>('');
  useEffect(() => {
    setAlignTargetLayerId('');
  }, [selectedLayer]);

  // For image (and text) layer dimension editing, maintain local input state
  const [layerWidthInput, setLayerWidthInput] = useState<string>('');
  const [layerHeightInput, setLayerHeightInput] = useState<string>('');
  const [layerXInput, setLayerXInput] = useState<string>('');
  const [layerYInput, setLayerYInput] = useState<string>('');
  useEffect(() => {
    if (selectedLayer) {
      setLayerWidthInput(String(Math.round(selectedLayer.width)));
      setLayerHeightInput(String(Math.round(selectedLayer.height)));
      setLayerXInput(String(Math.round(selectedLayer.x)));
      setLayerYInput(String(Math.round(selectedLayer.y)));
    }
  }, [selectedLayer]);

  // ---------------------------------------------------------------------------
  // State for measured bounding boxes of text layers
  const [textBBoxes, setTextBBoxes] = useState<{
    [id: string]: { x: number; y: number; width: number; height: number };
  }>({});
  const updateTextBBox = useCallback(
    (id: string, bbox: { x: number; y: number; width: number; height: number }) => {
      setTextBBoxes((prev) => ({ ...prev, [id]: bbox }));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Preview (canvas drag states)
  const [draggedLayer, setDraggedLayer] = useState<any>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const resizeTimeoutRef = useRef<any>(null);

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  // (Note: We no longer use a JSON Import/Export pane in the sidebar.)
  // ---------------------------------------------------------------------------
  // Layer Pane Drag-and-Drop States & Container Ref
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const layersContainerRef = useRef<HTMLDivElement>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const computeDropIndex = useCallback((clientY: number) => {
    let index = 0;
    if (layersContainerRef.current) {
      const children = Array.from(
        layersContainerRef.current.querySelectorAll('.layer-item-wrapper')
      );
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (clientY > rect.top + rect.height / 2) {
          index = i + 1;
        }
      }
    }
    return index;
  }, []);
  useEffect(() => {
    if (dragOverIndex !== null && layersContainerRef.current) {
      const children = layersContainerRef.current.querySelectorAll('.layer-item-wrapper');
      const containerRect = layersContainerRef.current.getBoundingClientRect();
      if (children.length === 0) {
        setDropIndicatorTop(0);
      } else if (dragOverIndex === 0) {
        const firstRect = children[0].getBoundingClientRect();
        setDropIndicatorTop(firstRect.top - containerRect.top);
      } else if (dragOverIndex > 0 && dragOverIndex <= children.length) {
        const child = children[dragOverIndex - 1];
        const childRect = child.getBoundingClientRect();
        setDropIndicatorTop(childRect.bottom - containerRect.top);
      } else {
        const lastRect = children[children.length - 1].getBoundingClientRect();
        setDropIndicatorTop(lastRect.bottom - containerRect.top);
      }
    } else {
      setDropIndicatorTop(null);
    }
  }, [dragOverIndex, layers]);
  const handleLayerDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedLayerIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleContainerDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const computed = computeDropIndex(e.clientY);
      setDragOverIndex(computed);
    },
    [computeDropIndex]
  );
  const handleContainerDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const computed = computeDropIndex(e.clientY);
      if (draggedLayerIndex === null) return;
      setLayers((prev: any[]) => {
        const newLayers = [...prev];
        const [moved] = newLayers.splice(draggedLayerIndex, 1);
        let targetIndex = computed;
        if (draggedLayerIndex < computed) {
          targetIndex = computed - 1;
        }
        newLayers.splice(targetIndex, 0, moved);
        return newLayers;
      });
      setDraggedLayerIndex(null);
      setDragOverIndex(null);
    },
    [computeDropIndex, draggedLayerIndex]
  );
  const handleContainerDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);
  // ---------------------------------------------------------------------------
  // Canvas Drag for Preview
  const handleDragStart = useCallback((e: React.MouseEvent, layer: any) => {
    if (!e.currentTarget.classList.contains('layer-item')) {
      if (!svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      setDraggedLayer(layer);
      setDragOffset({
        x: svgP.x - layer.x,
        y: svgP.y - layer.y
      });
      setSelectedLayerId(layer.id);
    }
  }, []);
  const handleDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedLayer || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      setLayers((prev: any[]) =>
        prev.map((l) =>
          l.id === draggedLayer.id
            ? { ...l, x: Math.round(svgP.x - dragOffset.x), y: Math.round(svgP.y - dragOffset.y) }
            : l
        )
      );
    },
    [draggedLayer, dragOffset]
  );
  // New resizeState includes initial values and aspect ratio
  const [resizeState, setResizeState] = useState<any>(null);
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, layer: any, handle: string) => {
      e.preventDefault();
      e.stopPropagation();
      setResizeState({
        layer,
        handle,
        initialX: layer.x,
        initialY: layer.y,
        initialWidth: layer.width,
        initialHeight: layer.height,
        aspectRatio: layer.width / layer.height
      });
      setSelectedLayerId(layer.id);
    },
    []
  );
  const handleResizeMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizeState || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      const { layer, handle, initialX, initialY, initialWidth, initialHeight, aspectRatio } = resizeState;
      setLayers((prev: any[]) =>
        prev.map((l) => {
          if (l.id !== layer.id) return l;
          const newProps = { ...l };
          if (l.lockAspectRatio) {
            // Locked resizing using initial values
            if (handle === 'e') {
              newProps.width = Math.max(50, Math.round(svgP.x - initialX));
              newProps.height = Math.round(newProps.width / aspectRatio);
            } else if (handle === 'w') {
              newProps.width = Math.max(50, Math.round(initialWidth + (initialX - svgP.x)));
              newProps.height = Math.round(newProps.width / aspectRatio);
              newProps.x = initialX + (initialWidth - newProps.width);
            } else if (handle === 's') {
              newProps.height = Math.max(20, Math.round(svgP.y - initialY));
              newProps.width = Math.round(newProps.height * aspectRatio);
            } else if (handle === 'n') {
              newProps.height = Math.max(20, Math.round(initialHeight + (initialY - svgP.y)));
              newProps.width = Math.round(newProps.height * aspectRatio);
              newProps.y = initialY + (initialHeight - newProps.height);
            } else if (handle === 'nw') {
              newProps.width = Math.max(50, Math.round((initialX + initialWidth) - svgP.x));
              newProps.height = Math.round(newProps.width / aspectRatio);
              newProps.x = initialX + initialWidth - newProps.width;
              newProps.y = initialY + initialHeight - newProps.height;
            } else if (handle === 'ne') {
              newProps.width = Math.max(50, Math.round(svgP.x - initialX));
              newProps.height = Math.round(newProps.width / aspectRatio);
              newProps.y = initialY + initialHeight - newProps.height;
            } else if (handle === 'sw') {
              newProps.width = Math.max(50, Math.round((initialX + initialWidth) - svgP.x));
              newProps.height = Math.round(newProps.width / aspectRatio);
              newProps.x = initialX + initialWidth - newProps.width;
            } else if (handle === 'se') {
              newProps.width = Math.max(50, Math.round(svgP.x - initialX));
              newProps.height = Math.round(newProps.width / aspectRatio);
            }
          } else {
            // Unlocked resizing using current values
            const currentAspectRatio = l.width / l.height;
            if (handle.includes('e')) {
              newProps.width = Math.max(50, Math.round(svgP.x - l.x));
              if (handle === 'e') newProps.height = Math.round(newProps.width / currentAspectRatio);
            }
            if (handle.includes('w')) {
              const diff = l.x - svgP.x;
              newProps.x = Math.round(svgP.x);
              newProps.width = Math.max(50, Math.round(l.width + diff));
              if (handle === 'w') newProps.height = Math.round(newProps.width / currentAspectRatio);
            }
            if (handle.includes('s')) {
              newProps.height = Math.max(20, Math.round(svgP.y - l.y));
              if (handle === 's') newProps.width = Math.round(newProps.height * currentAspectRatio);
            }
            if (handle.includes('n')) {
              const diff = l.y - svgP.y;
              newProps.y = Math.round(svgP.y);
              newProps.height = Math.max(20, Math.round(l.height + diff));
              if (handle === 'n') newProps.width = Math.round(newProps.height * currentAspectRatio);
            }
          }
          if (l.type === 'text') {
            newProps.size = Math.max(12, Math.round(newProps.width / 2));
          }
          newProps.x = Math.round(newProps.x);
          newProps.y = Math.round(newProps.y);
          newProps.width = Math.round(newProps.width);
          newProps.height = Math.round(newProps.height);
          return newProps;
        })
      );
    },
    [resizeState]
  );
  const handleDragEnd = useCallback(() => {
    setDraggedLayer(null);
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);
  // ---------------------------------------------------------------------------
  // New Layer Addition & Renaming with unique names
  const addNewLayer = useCallback(
    (type: string) => {
      setLayers((prev: any[]) => {
        const name = getUniqueLayerName(prev, type);
        const newLayer = {
          id: `layer_${Date.now()}`,
          type,
          name,
          text: type === 'text' ? 'New Text' : '',
          font: 'Arial',
          size: type === 'text' ? 36 : 0,
          color: '#FFFFFF',
          x: 100,
          y: 100,
          width: type === 'text' ? 100 : 200,
          height: type === 'text' ? 40 : 200,
          visible: true,
          opacity: 1,
          borderWidth: 0,
          borderColor: '#000000',
          lockAspectRatio: true,
          ...(type === 'image' && { src: '', useColorFill: false, fillColor: '#CCCCCC' }),
          ...(type === 'text' && {
            bold: false,
            italic: false,
            useBackground: false,
            backgroundColor: '#000000',
            bgPadding: 4
          })
        };
        return [newLayer, ...prev];
      });
    },
    []
  );
  // Duplicate Layer function
  const duplicateLayer = useCallback((layer: any) => {
    setLayers((prev: any[]) => {
      const newName = getUniqueLayerName(prev, layer.type);
      const newLayer = { ...layer, id: `layer_${Date.now()}`, name: newName };
      return [newLayer, ...prev];
    });
  }, []);
  // ---------------------------------------------------------------------------
  // Local state for layer name editing to prevent duplicates
  const [layerNameInput, setLayerNameInput] = useState<string>(
    selectedLayer ? selectedLayer.name : ''
  );
  const originalLayerNameRef = useRef<string>(selectedLayer ? selectedLayer.name : '');
  useEffect(() => {
    if (selectedLayer) {
      setLayerNameInput(selectedLayer.name);
      originalLayerNameRef.current = selectedLayer.name;
    }
  }, [selectedLayer]);
  // ---------------------------------------------------------------------------
  // Remove JSON Import/Export pane.
  // Instead, we add an Import button in the preview toolbar.
  const importFileRef = useRef<HTMLInputElement>(null);
  const handleImportFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (data.layers) setLayers(data.layers);
            if (data.canvasWidth) {
              setCanvasWidth(data.canvasWidth);
              setCanvasWidthInput(String(data.canvasWidth));
            }
            if (data.canvasHeight) {
              setCanvasHeight(data.canvasHeight);
              setCanvasHeightInput(String(data.canvasHeight));
            }
            if (data.backgroundImage) setBackgroundImage(data.backgroundImage);
          } catch (err) {
            alert('Invalid JSON file.');
          }
        };
        reader.readAsText(file);
      }
    },
    []
  );
  // ---------------------------------------------------------------------------
  // JSON Export remains for the Export button
  const exportPlaceholderData = {
    canvasWidth,
    canvasHeight,
    backgroundImage: backgroundImage ? '[Background Image]' : null,
    layers: layers.map((layer: any) => {
      if (layer.type === 'image') {
        return {
          ...layer,
          src: layer.src ? `[Image: ${layer.name || 'unnamed image'}]` : ''
        };
      }
      return layer;
    })
  };
  const jsonPlaceholder = JSON.stringify(exportPlaceholderData, null, 2);
  const handleExport = useCallback(() => {
    const exportData = JSON.stringify(exportPlaceholderData, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportPlaceholderData]);
  // ---------------------------------------------------------------------------
  // Updated PNG Export Handler
  const handleExportPNG = useCallback(() => {
    if (!svgRef.current) return;
    // Clone the SVG node so that we can remove the zoom transform without affecting the UI.
    const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
    // Remove the CSS transform (zoom) from the clone.
    clonedSvg.removeAttribute('style');
    // Ensure width and height attributes are set correctly.
    clonedSvg.setAttribute('width', String(canvasWidth));
    clonedSvg.setAttribute('height', String(canvasHeight));
    // Serialize the cloned SVG.
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      // Fill with white background (or any desired background color)
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      }
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = 'template.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(pngUrl);
        }
      });
    };
    img.src = url;
  }, [canvasWidth, canvasHeight]);
  // Handlers for canvas width/height input
  const handleCanvasWidthChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCanvasWidthInput(e.target.value);
  };
  const handleCanvasWidthBlur = (e: FocusEvent<HTMLInputElement>) => {
    const parsed = parseInt(canvasWidthInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setCanvasWidth(parsed);
      setCanvasWidthInput(String(parsed));
    } else {
      setCanvasWidthInput(String(canvasWidth));
    }
  };
  const handleCanvasHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCanvasHeightInput(e.target.value);
  };
  const handleCanvasHeightBlur = (e: FocusEvent<HTMLInputElement>) => {
    const parsed = parseInt(canvasHeightInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setCanvasHeight(parsed);
      setCanvasHeightInput(String(parsed));
    } else {
      setCanvasHeightInput(String(canvasHeight));
    }
  };
  // Handler for preset selection
  const handlePresetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setPreset(value);
    if (value) {
      const [w, h] = value.split('x').map((v) => parseInt(v, 10));
      if (!isNaN(w) && !isNaN(h)) {
        setCanvasWidth(w);
        setCanvasHeight(h);
        setCanvasWidthInput(String(w));
        setCanvasHeightInput(String(h));
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Helper functions for Alignment
  // getLayerBBox returns the measured bounding box for text layers (if available)
  // or the stored values for other layers.
  const getLayerBBox = (layer: any) => {
    if (layer.type === 'text' && textBBoxes[layer.id]) {
      return textBBoxes[layer.id];
    }
    return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  };

  const alignLayerHorizontally = (direction: 'left' | 'center' | 'right') => {
    if (!selectedLayer) return;
    const selectedBBox = getLayerBBox(selectedLayer);
    let targetBBox;
    if (alignTargetLayerId) {
      const targetLayer = layers.find((l: any) => l.id === alignTargetLayerId);
      if (!targetLayer) return;
      targetBBox = getLayerBBox(targetLayer);
    } else {
      targetBBox = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    }
    let deltaX = 0;
    if (direction === 'left') {
      deltaX = targetBBox.x - selectedBBox.x;
    } else if (direction === 'center') {
      deltaX =
        (targetBBox.x + targetBBox.width / 2) - (selectedBBox.x + selectedBBox.width / 2);
    } else if (direction === 'right') {
      deltaX = (targetBBox.x + targetBBox.width) - (selectedBBox.x + selectedBBox.width);
    }
    setLayers((prev) =>
      prev.map((l) =>
        l.id === selectedLayer.id ? { ...l, x: Math.round(l.x + deltaX) } : l
      )
    );
  };

  const alignLayerVertically = (direction: 'top' | 'middle' | 'bottom') => {
    if (!selectedLayer) return;
    const selectedBBox = getLayerBBox(selectedLayer);
    let targetBBox;
    if (alignTargetLayerId) {
      const targetLayer = layers.find((l: any) => l.id === alignTargetLayerId);
      if (!targetLayer) return;
      targetBBox = getLayerBBox(targetLayer);
    } else {
      targetBBox = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    }
    let deltaY = 0;
    if (direction === 'top') {
      deltaY = targetBBox.y - selectedBBox.y;
    } else if (direction === 'middle') {
      deltaY =
        (targetBBox.y + targetBBox.height / 2) - (selectedBBox.y + selectedBBox.height / 2);
    } else if (direction === 'bottom') {
      deltaY = (targetBBox.y + targetBBox.height) - (selectedBBox.y + selectedBBox.height);
    }
    setLayers((prev) =>
      prev.map((l) =>
        l.id === selectedLayer.id ? { ...l, y: Math.round(l.y + deltaY) } : l
      )
    );
  };

  // ---------------------------------------------------------------------------
  // Alignment Settings for the properties panel
  // These buttons adjust the x and y of the selected layer based on its measured bounding box.
  const renderAlignmentSettings = () => {
    if (!selectedLayer) return null;
    return (
      <>
        <div className="mb-4">
          <label className="block text-sm font-medium">Align With</label>
          <select
            value={alignTargetLayerId}
            onChange={(e) => setAlignTargetLayerId(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md"
          >
            <option value="">Canvas</option>
            {layers
              .filter((l: any) => l.id !== selectedLayer.id)
              .map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name || l.text || l.id}
                </option>
              ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Horizontal Alignment</label>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => alignLayerHorizontally('left')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Left"
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => alignLayerHorizontally('center')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Center"
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => alignLayerHorizontally('right')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Right"
            >
              <AlignRight size={16} />
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Vertical Alignment</label>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => alignLayerVertically('top')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Top"
            >
              <AlignStartVertical size={16} />
            </button>
            <button
              onClick={() => alignLayerVertically('middle')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Middle"
            >
              <AlignCenterVertical size={16} />
            </button>
            <button
              onClick={() => alignLayerVertically('bottom')}
              className="px-2 py-1 border rounded hover:bg-gray-100"
              title="Align Bottom"
            >
              <AlignEndVertical size={16} />
            </button>
          </div>
        </div>
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Auto-save to localStorage
  useEffect(() => {
    const stateToSave = {
      canvasWidth,
      canvasHeight,
      layers,
      backgroundImage
    };
    localStorage.setItem('templateEditorState', JSON.stringify(stateToSave));
  }, [canvasWidth, canvasHeight, layers, backgroundImage]);
  useEffect(() => {
    const saved = localStorage.getItem('templateEditorState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.layers) setLayers(state.layers);
        if (state.canvasWidth) {
          setCanvasWidth(state.canvasWidth);
          setCanvasWidthInput(String(state.canvasWidth));
        }
        if (state.canvasHeight) {
          setCanvasHeight(state.canvasHeight);
          setCanvasHeightInput(String(state.canvasHeight));
        }
        if (state.backgroundImage) setBackgroundImage(state.backgroundImage);
      } catch (e) {
        console.error('Error loading state', e);
      }
    }
  }, []);

  if (renderOnly) {
    return (
      <div className="w-full">
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="border"
        >
          {backgroundImage ? (
            <image
              href={backgroundImage}
              width={canvasWidth}
              height={canvasHeight}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <rect width={canvasWidth} height={canvasHeight} fill="#f0f0f0" />
          )}
          {layers
            .slice()
            .reverse()
            .filter((l: any) => l.visible)
            .map((layer: any) => (
              <g key={layer.id}>
                {layer.type === 'text' ? (
                  <>
                    {layer.useBackground && textBBoxes[layer.id] && (
                      <rect
                        x={textBBoxes[layer.id].x - layer.bgPadding}
                        y={textBBoxes[layer.id].y - layer.bgPadding}
                        width={textBBoxes[layer.id].width + 2 * layer.bgPadding}
                        height={textBBoxes[layer.id].height + 2 * layer.bgPadding}
                        fill={layer.backgroundColor}
                        opacity={layer.opacity ?? 1}
                      />
                    )}
                    <TextLayer
                      layer={layer}
                      onDragStart={handleDragStart}
                      updateBBox={updateTextBBox}
                    />
                    {layer.borderWidth > 0 && textBBoxes[layer.id] && (
                      <rect
                        x={textBBoxes[layer.id].x}
                        y={textBBoxes[layer.id].y}
                        width={textBBoxes[layer.id].width}
                        height={textBBoxes[layer.id].height}
                        fill="none"
                        stroke={layer.borderColor}
                        strokeWidth={layer.borderWidth}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {layer.type === 'image' &&
                      (layer.useColorFill ? (
                        <rect
                          x={layer.x}
                          y={layer.y}
                          width={layer.width}
                          height={layer.height}
                          fill={layer.fillColor}
                          opacity={layer.opacity ?? 1}
                        />
                      ) : (
                        layer.src && (
                          <image
                            href={layer.src}
                            x={layer.x}
                            y={layer.y}
                            width={layer.width}
                            height={layer.height}
                            preserveAspectRatio={
                              layer.src && !layer.src.startsWith('data:')
                                ? 'none'
                                : 'xMidYMid meet'
                            }
                            opacity={layer.opacity ?? 1}
                          />
                        )
                      ))}
                    {layer.borderWidth > 0 && (
                      <rect
                        x={layer.x}
                        y={layer.y}
                        width={layer.width}
                        height={layer.height}
                        fill="none"
                        stroke={layer.borderColor}
                        strokeWidth={layer.borderWidth}
                      />
                    )}
                  </>
                )}
              </g>
            ))}
        </svg>
        <button
          onClick={handleExportPNG}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Download Image
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-4 w-full">
      {/* Left Sidebar */}
      <div className="flex flex-col gap-4 w-80">
        {/* Canvas Settings */}
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-2">Canvas Settings</h3>
          <div className="mb-2">
            <label className="block text-sm font-medium">Template Presets</label>
            <select
              value={preset}
              onChange={handlePresetChange}
              className="mt-1 block w-full border-gray-300 rounded-md"
            >
              {canvasPresets.map((option) => (
                <option key={option.value || 'custom'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Canvas Width</label>
            <input
              type="number"
              value={canvasWidthInput}
              onChange={handleCanvasWidthChange}
              onBlur={handleCanvasWidthBlur}
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Canvas Height</label>
            <input
              type="number"
              value={canvasHeightInput}
              onChange={handleCanvasHeightChange}
              onBlur={handleCanvasHeightBlur}
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
        </Card>
        {/* Layer Pane */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Layers</h2>
            <div className="flex gap-2">
              <button
                onClick={() => addNewLayer('text')}
                className="p-2 rounded hover:bg-gray-100"
                title="Add Text Layer"
              >
                <Type size={20} />
              </button>
              <button
                onClick={() => addNewLayer('image')}
                className="p-2 rounded hover:bg-gray-100"
                title="Add Image Layer"
              >
                <ImageIcon size={20} />
              </button>
            </div>
          </div>
          <div
            ref={layersContainerRef}
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
            onDragLeave={handleContainerDragLeave}
            className="relative space-y-2"
          >
            {layers.map((layer: any, index: number) => (
              <div key={layer.id} className="layer-item-wrapper">
                <div
                  className="flex justify-between items-center w-full p-2 rounded transition-all duration-100 cursor-pointer hover:bg-gray-100"
                  onClick={() => setSelectedLayerId(layer.id)}
                  draggable
                  onDragStart={(e) => handleLayerDragStart(e, index)}
                  onDragEnd={() => setDraggedLayerIndex(null)}
                >
                  {/* Left section: icons and layer name */}
                  <div className="flex items-center flex-1 overflow-hidden space-x-2">
                    <span className="text-gray-400">⋮⋮</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                          )
                        );
                      }}
                      className="p-1 rounded hover:bg-gray-200"
                      title="Toggle Visibility"
                    >
                      {layer.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    {layer.type === 'text' ? <Type size={16} /> : <ImageIcon size={16} />}
                    <span className="truncate">{layer.name || layer.text || layer.id}</span>
                  </div>
                  {/* Right section: duplicate and delete buttons */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateLayer(layer);
                      }}
                      className="flex items-center justify-center p-1 w-8 h-8 rounded hover:bg-gray-200"
                      title="Duplicate Layer"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this layer?')) {
                          setLayers((prev: any[]) => prev.filter((l) => l.id !== layer.id));
                          if (selectedLayerId === layer.id) setSelectedLayerId(null);
                        }
                      }}
                      className="flex items-center justify-center p-1 w-8 h-8 rounded hover:bg-red-100"
                      title="Delete Layer"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {dropIndicatorTop !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: dropIndicatorTop,
                  height: '2px',
                  backgroundColor: 'blue'
                }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all layers?')) {
                  setLayers([]);
                  setSelectedLayerId(null);
                }
              }}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Clear All Layers
            </button>
          </div>
        </Card>
      </div>
      {/* Center Preview Pane */}
      <div className="flex-1">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Preview</h2>
            <div className="flex items-center gap-2">
              {/* Import button */}
              <button
                onClick={() => importFileRef.current?.click()}
                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                title="Import JSON"
              >
                Import
              </button>
              <button
                onClick={() => setZoom((prev) => prev / 1.25)}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => setZoom((prev) => prev * 1.25)}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                title="Zoom In"
              >
                +
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded"
                onClick={handleExport}
                title="Export JSON"
              >
                <Download size={20} />
                Export
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded"
                onClick={handleExportPNG}
                title="Export PNG"
              >
                <FileImage size={20} />
                PNG
              </button>
              <input
                type="file"
                accept="application/json"
                ref={importFileRef}
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          <div
            className="border"
            style={{ width: '1080px', height: '1080px', overflow: 'hidden' }}
          >
            <svg
              ref={svgRef}
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="border"
              onMouseMove={(e) => {
                handleDrag(e);
                handleResizeMove(e);
              }}
              onMouseUp={() => {
                handleDragEnd();
                setResizeState(null);
              }}
              onMouseLeave={() => {
                handleDragEnd();
                setResizeState(null);
              }}
            >
              {backgroundImage ? (
                <image
                  href={backgroundImage}
                  width={canvasWidth}
                  height={canvasHeight}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <rect width={canvasWidth} height={canvasHeight} fill="#f0f0f0" />
              )}
              {layers
                .slice()
                .reverse()
                .filter((l: any) => l.visible)
                .map((layer: any) => (
                  <g key={layer.id}>
                    {layer.type === 'text' ? (
                      <>
                        {layer.useBackground && textBBoxes[layer.id] && (
                          <rect
                            x={textBBoxes[layer.id].x - layer.bgPadding}
                            y={textBBoxes[layer.id].y - layer.bgPadding}
                            width={textBBoxes[layer.id].width + 2 * layer.bgPadding}
                            height={textBBoxes[layer.id].height + 2 * layer.bgPadding}
                            fill={layer.backgroundColor}
                            opacity={layer.opacity ?? 1}
                          />
                        )}
                        <TextLayer
                          layer={layer}
                          onDragStart={handleDragStart}
                          updateBBox={updateTextBBox}
                        />
                        {layer.borderWidth > 0 && textBBoxes[layer.id] && (
                          <rect
                            x={textBBoxes[layer.id].x}
                            y={textBBoxes[layer.id].y}
                            width={textBBoxes[layer.id].width}
                            height={textBBoxes[layer.id].height}
                            fill="none"
                            stroke={layer.borderColor}
                            strokeWidth={layer.borderWidth}
                          />
                        )}
                        {selectedLayerId === layer.id && (
                          <BoundingBox
                            layer={layer}
                            onResizeStart={handleResizeStart}
                            bbox={textBBoxes[layer.id]}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {layer.type === 'image' &&
                          (layer.useColorFill ? (
                            <rect
                              x={layer.x}
                              y={layer.y}
                              width={layer.width}
                              height={layer.height}
                              fill={layer.fillColor}
                              style={{ cursor: 'move' }}
                              opacity={layer.opacity ?? 1}
                              onMouseDown={(e) => handleDragStart(e, layer)}
                            />
                          ) : (
                            layer.src && (
                              <image
                                href={layer.src}
                                x={layer.x}
                                y={layer.y}
                                width={layer.width}
                                height={layer.height}
                                preserveAspectRatio={
                                  layer.src && !layer.src.startsWith('data:')
                                    ? 'none'
                                    : 'xMidYMid meet'
                                }
                                style={{ cursor: 'move' }}
                                opacity={layer.opacity ?? 1}
                                onMouseDown={(e) => handleDragStart(e, layer)}
                              />
                            )
                          ))}
                        {layer.borderWidth > 0 && (
                          <rect
                            x={layer.x}
                            y={layer.y}
                            width={layer.width}
                            height={layer.height}
                            fill="none"
                            stroke={layer.borderColor}
                            strokeWidth={layer.borderWidth}
                          />
                        )}
                        {selectedLayerId === layer.id && (
                          <BoundingBox layer={layer} onResizeStart={handleResizeStart} />
                        )}
                      </>
                    )}
                  </g>
                ))}
            </svg>
          </div>
        </Card>
      </div>
      {/* Right Sidebar: Properties Panel */}
      <div className="w-64 flex-shrink-0">
        {selectedLayer ? (
          <Card className="p-4">
            <h3 className="text-lg font-bold mb-2">Layer Properties</h3>
            <div className="mb-2">
              <label className="block text-sm font-medium">Layer Name</label>
              <input
                type="text"
                value={layerNameInput}
                onChange={(e) => setLayerNameInput(e.target.value)}
                onBlur={() => {
                  const duplicate = layers.find(
                    (l: any) => l.name === layerNameInput && l.id !== selectedLayer.id
                  );
                  if (duplicate) {
                    alert('Error: A layer with that name already exists.');
                    setLayerNameInput(originalLayerNameRef.current);
                  } else {
                    setLayers((prev: any[]) =>
                      prev.map((l) =>
                        l.id === selectedLayer.id ? { ...l, name: layerNameInput } : l
                      )
                    );
                    originalLayerNameRef.current = layerNameInput;
                  }
                }}
                className="mt-1 block w-full border-gray-300 rounded-md"
              />
            </div>
            {selectedLayer.type === 'text' && (
              <>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Text</label>
                  <input
                    type="text"
                    value={selectedLayer.text}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setLayers((prev: any[]) =>
                        prev.map((l) =>
                          l.id === selectedLayer.id ? { ...l, text: newText } : l
                        )
                      );
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Font</label>
                  <select
                    value={selectedLayer.font}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setLayers((prev: any[]) =>
                        prev.map((l) =>
                          l.id === selectedLayer.id ? { ...l, font: newFont } : l
                        )
                      );
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Font Size</label>
                  <input
                    type="number"
                    value={selectedLayer.size}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      if (!isNaN(newSize)) {
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, size: newSize } : l
                          )
                        );
                      }
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Color</label>
                  <input
                    type="color"
                    value={selectedLayer.color}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setLayers((prev: any[]) =>
                        prev.map((l) =>
                          l.id === selectedLayer.id ? { ...l, color: newColor } : l
                        )
                      );
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  />
                </div>
                {/* WYSIWYG text styling controls */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Text Styling</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => {
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, bold: !l.bold } : l
                          )
                        );
                      }}
                      className={`px-2 py-1 border rounded ${
                        selectedLayer.bold ? 'bg-blue-500 text-white' : 'bg-white'
                      }`}
                      title="Toggle Bold"
                    >
                      B
                    </button>
                    <button
                      onClick={() => {
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, italic: !l.italic } : l
                          )
                        );
                      }}
                      className={`px-2 py-1 border rounded ${
                        selectedLayer.italic ? 'bg-blue-500 text-white' : 'bg-white'
                      }`}
                      title="Toggle Italic"
                    >
                      <span style={{ fontStyle: 'italic' }}>I</span>
                    </button>
                  </div>
                </div>
                {/* Background Options for Text Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Background Options</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={selectedLayer.useBackground}
                      onChange={(e) => {
                        const useBg = e.target.checked;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, useBackground: useBg } : l
                          )
                        );
                      }}
                    />
                    <span className="text-sm">Enable Background</span>
                  </div>
                  {selectedLayer.useBackground && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500">Background Color</label>
                      <input
                        type="color"
                        value={selectedLayer.backgroundColor}
                        onChange={(e) => {
                          const newBg = e.target.value;
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id
                                ? { ...l, backgroundColor: newBg }
                                : l
                            )
                          );
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                      <label className="block text-xs text-gray-500 mt-2">Padding</label>
                      <input
                        type="number"
                        value={selectedLayer.bgPadding}
                        onChange={(e) => {
                          const newPad = parseInt(e.target.value, 10);
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id
                                ? { ...l, bgPadding: isNaN(newPad) ? 0 : newPad }
                                : l
                            )
                          );
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>
                {/* Border Settings for Text Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Border Settings</label>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500">Border Width</label>
                    <input
                      type="number"
                      value={selectedLayer.borderWidth}
                      onChange={(e) => {
                        const bw = parseInt(e.target.value, 10) || 0;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, borderWidth: bw } : l
                          )
                        );
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500">Border Color</label>
                    <input
                      type="color"
                      value={selectedLayer.borderColor}
                      onChange={(e) => {
                        const bc = e.target.value;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, borderColor: bc } : l
                          )
                        );
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                {/* Dimensions & Position for Text Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Dimensions</label>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Width</label>
                      <input
                        type="number"
                        value={layerWidthInput}
                        onChange={(e) => setLayerWidthInput(e.target.value)}
                        onBlur={() => {
                          const newWidth = parseInt(layerWidthInput, 10);
                          if (!isNaN(newWidth) && newWidth > 0) {
                            setLayers((prev: any[]) =>
                              prev.map((l) => {
                                if (l.id !== selectedLayer.id) return l;
                                if (l.lockAspectRatio) {
                                  const aspectRatio = l.width / l.height;
                                  return { ...l, width: newWidth, height: Math.round(newWidth / aspectRatio) };
                                } else {
                                  return { ...l, width: newWidth };
                                }
                              })
                            );
                            setLayerWidthInput(String(newWidth));
                          } else {
                            setLayerWidthInput(String(selectedLayer.width));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="pt-5">×</div>
                    <div>
                      <label className="block text-xs text-gray-500">Height</label>
                      <input
                        type="number"
                        value={layerHeightInput}
                        onChange={(e) => setLayerHeightInput(e.target.value)}
                        onBlur={() => {
                          const newHeight = parseInt(layerHeightInput, 10);
                          if (!isNaN(newHeight) && newHeight > 0) {
                            setLayers((prev: any[]) =>
                              prev.map((l) => {
                                if (l.id !== selectedLayer.id) return l;
                                if (l.lockAspectRatio) {
                                  const aspectRatio = l.width / l.height;
                                  return { ...l, height: newHeight, width: Math.round(newHeight * aspectRatio) };
                                } else {
                                  return { ...l, height: newHeight };
                                }
                              })
                            );
                            setLayerHeightInput(String(newHeight));
                          } else {
                            setLayerHeightInput(String(selectedLayer.height));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="pt-5">
                      <button
                        onClick={() => {
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id ? { ...l, lockAspectRatio: !l.lockAspectRatio } : l
                            )
                          );
                        }}
                        className="p-1 border rounded"
                        title={selectedLayer.lockAspectRatio ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                      >
                        {selectedLayer.lockAspectRatio ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Aspect Ratio: {(selectedLayer.width / selectedLayer.height).toFixed(2)}
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Position</label>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">X</label>
                      <input
                        type="number"
                        value={layerXInput}
                        onChange={(e) => setLayerXInput(e.target.value)}
                        onBlur={() => {
                          const newX = parseInt(layerXInput, 10);
                          if (!isNaN(newX)) {
                            setLayers((prev: any[]) =>
                              prev.map((l) =>
                                l.id === selectedLayer.id ? { ...l, x: newX } : l
                              )
                            );
                            setLayerXInput(String(newX));
                          } else {
                            setLayerXInput(String(selectedLayer.x));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Y</label>
                      <input
                        type="number"
                        value={layerYInput}
                        onChange={(e) => setLayerYInput(e.target.value)}
                        onBlur={() => {
                          const newY = parseInt(layerYInput, 10);
                          if (!isNaN(newY)) {
                            setLayers((prev: any[]) =>
                              prev.map((l) =>
                                l.id === selectedLayer.id ? { ...l, y: newY } : l
                              )
                            );
                            setLayerYInput(String(newY));
                          } else {
                            setLayerYInput(String(selectedLayer.y));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {selectedLayer.type === 'image' && (
              <>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Image URL</label>
                  <input
                    type="url"
                    value={selectedLayer.imageUrl || ''}
                    onChange={(e) => {
                      setLayers((prev: any[]) =>
                        prev.map((l) =>
                          l.id === selectedLayer.id
                            ? { ...l, imageUrl: e.target.value }
                            : l
                        )
                      );
                    }}
                    onBlur={(e) => {
                      const url = e.target.value;
                      if (url) {
                        if (!/\.(jpeg|jpg|gif|png)$/i.test(url)) {
                          alert('Please enter a valid image URL (jpg, jpeg, png, gif).');
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id ? { ...l, imageUrl: '' } : l
                            )
                          );
                        } else {
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id ? { ...l, src: url } : l
                            )
                          );
                        }
                      }
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Image Source</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const { dataUrl, width, height } = await resizeImage(file);
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id
                                ? { ...l, src: dataUrl, width, height }
                                : l
                            )
                          );
                        } catch (error) {
                          console.error('Error processing image:', error);
                        }
                      }
                    }}
                    className="mt-1 block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                </div>
                {/* Fill Options for Image Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Fill Options</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={selectedLayer.useColorFill}
                      onChange={(e) => {
                        const useFill = e.target.checked;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id
                              ? { ...l, useColorFill: useFill }
                              : l
                          )
                        );
                      }}
                    />
                    <span className="text-sm">Use Color Fill</span>
                  </div>
                  {selectedLayer.useColorFill && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500">Fill Color</label>
                      <input
                        type="color"
                        value={selectedLayer.fillColor}
                        onChange={(e) => {
                          const newFill = e.target.value;
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id ? { ...l, fillColor: newFill } : l
                            )
                          );
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>
                {/* Border Settings for Image Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Border Settings</label>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500">Border Width</label>
                    <input
                      type="number"
                      value={selectedLayer.borderWidth}
                      onChange={(e) => {
                        const bw = parseInt(e.target.value, 10) || 0;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, borderWidth: bw } : l
                          )
                        );
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500">Border Color</label>
                    <input
                      type="color"
                      value={selectedLayer.borderColor}
                      onChange={(e) => {
                        const bc = e.target.value;
                        setLayers((prev: any[]) =>
                          prev.map((l) =>
                            l.id === selectedLayer.id ? { ...l, borderColor: bc } : l
                          )
                        );
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                {/* Dimensions & Position for Image Layers */}
                <div className="mb-2">
                  <label className="block text-sm font-medium">Dimensions</label>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Width</label>
                      <input
                        type="number"
                        value={layerWidthInput}
                        onChange={(e) => setLayerWidthInput(e.target.value)}
                        onBlur={() => {
                          const newWidth = parseInt(layerWidthInput, 10);
                          if (!isNaN(newWidth) && newWidth > 0) {
                            setLayers((prev: any[]) =>
                              prev.map((l) => {
                                if (l.id !== selectedLayer.id) return l;
                                if (l.lockAspectRatio) {
                                  const aspectRatio = l.width / l.height;
                                  return { ...l, width: newWidth, height: Math.round(newWidth / aspectRatio) };
                                } else {
                                  return { ...l, width: newWidth };
                                }
                              })
                            );
                            setLayerWidthInput(String(newWidth));
                          } else {
                            setLayerWidthInput(String(selectedLayer.width));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="pt-5">×</div>
                    <div>
                      <label className="block text-xs text-gray-500">Height</label>
                      <input
                        type="number"
                        value={layerHeightInput}
                        onChange={(e) => setLayerHeightInput(e.target.value)}
                        onBlur={() => {
                          const newHeight = parseInt(layerHeightInput, 10);
                          if (!isNaN(newHeight) && newHeight > 0) {
                            setLayers((prev: any[]) =>
                              prev.map((l) => {
                                if (l.id !== selectedLayer.id) return l;
                                if (l.lockAspectRatio) {
                                  const aspectRatio = l.width / l.height;
                                  return { ...l, height: newHeight, width: Math.round(newHeight * aspectRatio) };
                                } else {
                                  return { ...l, height: newHeight };
                                }
                              })
                            );
                            setLayerHeightInput(String(newHeight));
                          } else {
                            setLayerHeightInput(String(selectedLayer.height));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="pt-5">
                      <button
                        onClick={() => {
                          setLayers((prev: any[]) =>
                            prev.map((l) =>
                              l.id === selectedLayer.id ? { ...l, lockAspectRatio: !l.lockAspectRatio } : l
                            )
                          );
                        }}
                        className="p-1 border rounded"
                        title={selectedLayer.lockAspectRatio ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                      >
                        {selectedLayer.lockAspectRatio ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Aspect Ratio: {(selectedLayer.width / selectedLayer.height).toFixed(2)}
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Position</label>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">X</label>
                      <input
                        type="number"
                        value={layerXInput}
                        onChange={(e) => setLayerXInput(e.target.value)}
                        onBlur={() => {
                          const newX = parseInt(layerXInput, 10);
                          if (!isNaN(newX)) {
                            setLayers((prev: any[]) =>
                              prev.map((l) =>
                                l.id === selectedLayer.id ? { ...l, x: newX } : l
                              )
                            );
                            setLayerXInput(String(newX));
                          } else {
                            setLayerXInput(String(selectedLayer.x));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Y</label>
                      <input
                        type="number"
                        value={layerYInput}
                        onChange={(e) => setLayerYInput(e.target.value)}
                        onBlur={() => {
                          const newY = parseInt(layerYInput, 10);
                          if (!isNaN(newY)) {
                            setLayers((prev: any[]) =>
                              prev.map((l) =>
                                l.id === selectedLayer.id ? { ...l, y: newY } : l
                              )
                            );
                            setLayerYInput(String(newY));
                          } else {
                            setLayerYInput(String(selectedLayer.y));
                          }
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {/* Alignment Settings Section */}
            {renderAlignmentSettings()}
          </Card>
        ) : (
          <Card className="p-4">
            <h3 className="text-lg font-bold">No Layer Selected</h3>
          </Card>
        )}
      </div>
    </div>
  );
}

export default TemplateEditor;
