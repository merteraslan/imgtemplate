// src/TemplateEditor.tsx
'use client';

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  ChangeEvent,
  MouseEvent,
  DragEvent
} from 'react';
// Importing Card from a UI library – ensure your tsconfig paths are set up correctly
import { Card } from '@/components/ui/card';
// Import only the icons that are actually used in this file
import { Image as ImageIcon, Type, Download, FileImage } from 'lucide-react';

import styles from './TemplateEditor.module.css';
import {
  Layer,
  ImageLayer,
  TemplateData,
  BoundingBox
} from '../types/templateTypes';
import { resizeImage } from '../utils/imageUtils';
import { canvasPresets, getUniqueLayerName } from '../utils/canvasUtils';
// Import our dedicated TextLayer component for rendering text layers
// import TextLayer from './TextLayer';
import CanvasPreview from './CanvasPreview';
import LayerList from './LayerList';
import LayerProperties from './LayerProperties';

interface TemplateEditorProps {
  width?: number;
  height?: number;
  jsonData?: TemplateData;
  renderOnly?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  width = 1080,
  height = 1080,
  jsonData,
  renderOnly
}) => {
  // Default template data if no jsonData is provided
  const defaultTemplateData: TemplateData = {
    canvasWidth: 1080,
    canvasHeight: 1080,
    backgroundImage:
      'https://unsplash.com/photos/kLOuJrm-Wnk/download?ixid=M3wxMjA3fDB8MXxhbGx8MTB8fHx8fHx8fDE3MzkyNDI5Mzd8&force=true&w=1920.png',
    layers: [
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
      }
    ]
  };

  const effectiveTemplateData = jsonData || defaultTemplateData;

  // Initialize layers with background image if present
  const initializeLayers = useCallback(() => {
    const templateLayers = effectiveTemplateData.layers || [];
    if (effectiveTemplateData.backgroundImage) {
      // Find existing background layer or create new one
      const backgroundLayer: ImageLayer = {
        id: 'background_layer',
        type: 'image',
        name: 'Background',
        useColorFill: false,
        fillColor: '#e0e0e0',
        x: 0,
        y: 0,
        width: effectiveTemplateData.canvasWidth || width,
        height: effectiveTemplateData.canvasHeight || height,
        visible: true,
        opacity: 1,
        borderWidth: 0,
        borderColor: '#000000',
        src: effectiveTemplateData.backgroundImage,
        lockAspectRatio: true
      };

      const existingBgIndex = templateLayers.findIndex(l => l.id === 'background_layer');
      if (existingBgIndex >= 0) {
        templateLayers[existingBgIndex] = backgroundLayer;
      } else {
        templateLayers.push(backgroundLayer);
      }
    }
    return templateLayers;
  }, [effectiveTemplateData, width, height]);

  // Canvas settings
  const [canvasWidth, setCanvasWidth] = useState<number>(
    effectiveTemplateData.canvasWidth || width
  );
  const [canvasHeight, setCanvasHeight] = useState<number>(
    effectiveTemplateData.canvasHeight || height
  );
  const [canvasWidthInput, setCanvasWidthInput] = useState<string>(
    String(effectiveTemplateData.canvasWidth || width)
  );
  const [canvasHeightInput, setCanvasHeightInput] = useState<string>(
    String(effectiveTemplateData.canvasHeight || height)
  );
  const [preset, setPreset] = useState<string>('1080x1080');
  const [zoom, setZoom] = useState<number>(0.5);

  // Layers and selection state
  const [layers, setLayers] = useState<Layer[]>(() => initializeLayers());
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const selectedLayer: Layer | null =
    layers.find((l) => l.id === selectedLayerId) || null;

  // Alignment target state
  const [alignTargetLayerId, setAlignTargetLayerId] = useState<string>('');
  useEffect(() => {
    setAlignTargetLayerId('');
  }, [selectedLayer]);

  // Local state for dimension inputs
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

  // Text bounding boxes state
  const [textBBoxes, setTextBBoxes] = useState<{ [id: string]: BoundingBox }>({});
  const updateTextBBox = useCallback((id: string, bbox: BoundingBox): void => {
    setTextBBoxes((prev) => ({ ...prev, [id]: bbox }));
  }, []);

  // Drag and drop states for canvas preview
  const [draggedLayer, setDraggedLayer] = useState<Layer | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    effectiveTemplateData.backgroundImage || null
  );

  // Layer pane drag and drop state
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const layersContainerRef = useRef<HTMLDivElement>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const computeDropIndex = useCallback((clientY: number): number => {
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

  const handleLayerDragStart = useCallback(
    (e: DragEvent<Element>, index: number): void => {
      setDraggedLayerIndex(index);
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );
  const handleContainerDragOver = useCallback(
    (e: DragEvent<Element>): void => {
      e.preventDefault();
      const computed = computeDropIndex(e.clientY);
      setDragOverIndex(computed);
    },
    [computeDropIndex]
  );
  const handleContainerDrop = useCallback(
    (e: DragEvent<Element>): void => {
      e.preventDefault();
      const computed = computeDropIndex(e.clientY);
      if (draggedLayerIndex === null) return;
      setLayers((prev: Layer[]) => {
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
  const handleContainerDragLeave = useCallback((): void => {
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback(
    (e: MouseEvent<Element>, layer: Layer): void => {
      // Only start drag if not clicking on an element with the "layer-item" class
      if (!e.currentTarget.classList.contains('layer-item')) {
        if (!svgRef.current) return;
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgP = pt.matrixTransform(ctm.inverse());
        setDraggedLayer(layer);
        setDragOffset({
          x: svgP.x - layer.x,
          y: svgP.y - layer.y
        });
        setSelectedLayerId(layer.id);
      }
    },
    []
  );
  const handleDrag = useCallback(
    (e: MouseEvent<Element>): void => {
      if (!draggedLayer || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgP = pt.matrixTransform(ctm.inverse());
      setLayers((prev: Layer[]) =>
        prev.map((l) =>
          l.id === draggedLayer.id
            ? {
              ...l,
              x: Math.round(svgP.x - dragOffset.x),
              y: Math.round(svgP.y - dragOffset.y)
            }
            : l
        )
      );
    },
    [draggedLayer, dragOffset]
  );

  const [resizeState, setResizeState] = useState<{
    layer: Layer;
    handle: string;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    aspectRatio: number;
  } | null>(null);
  const handleResizeStart = useCallback(
    (e: MouseEvent<Element>, layer: Layer, handle: string): void => {
      e.preventDefault();
      e.stopPropagation();
      setResizeState({
        layer,
        handle,
        initialX: layer.x,
        initialY: layer.y,
        initialWidth: layer.width,
        initialHeight: layer.height,
        aspectRatio: layer.height !== 0 ? layer.width / layer.height : 1
      });
      setSelectedLayerId(layer.id);
    },
    []
  );
  const handleResizeMove = useCallback(
    (e: MouseEvent<Element>): void => {
      if (!resizeState || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgP = pt.matrixTransform(ctm.inverse());
      const { layer, handle, initialX, initialY, initialWidth, initialHeight, aspectRatio } = resizeState;
      setLayers((prev: Layer[]) =>
        prev.map((l) => {
          if (l.id !== layer.id) return l;
          const newLayer = { ...l };
          if (l.lockAspectRatio) {
            if (handle === 'e') {
              newLayer.width = Math.max(50, Math.round(svgP.x - initialX));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
            } else if (handle === 'w') {
              newLayer.width = Math.max(50, Math.round(initialWidth + (initialX - svgP.x)));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
              newLayer.x = initialX + (initialWidth - newLayer.width);
            } else if (handle === 's') {
              newLayer.height = Math.max(20, Math.round(svgP.y - initialY));
              newLayer.width = Math.round(newLayer.height * aspectRatio);
            } else if (handle === 'n') {
              newLayer.height = Math.max(20, Math.round(initialHeight + (initialY - svgP.y)));
              newLayer.width = Math.round(newLayer.height * aspectRatio);
              newLayer.y = initialY + (initialHeight - newLayer.height);
            } else if (handle === 'nw') {
              newLayer.width = Math.max(50, Math.round((initialX + initialWidth) - svgP.x));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
              newLayer.x = initialX + (initialWidth - newLayer.width);
              newLayer.y = initialY + (initialHeight - newLayer.height);
            } else if (handle === 'ne') {
              newLayer.width = Math.max(50, Math.round(svgP.x - initialX));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
              newLayer.y = initialY + (initialHeight - newLayer.height);
            } else if (handle === 'sw') {
              newLayer.width = Math.max(50, Math.round((initialX + initialWidth) - svgP.x));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
              newLayer.x = initialX + (initialWidth - newLayer.width);
            } else if (handle === 'se') {
              newLayer.width = Math.max(50, Math.round(svgP.x - initialX));
              newLayer.height = Math.round(newLayer.width / aspectRatio);
            }
          } else {
            // When aspect ratio is unlocked, allow independent width/height changes
            if (handle === 'e') {
              // Right edge - only width changes
              newLayer.width = Math.max(50, Math.round(svgP.x - initialX));
            } else if (handle === 'w') {
              // Left edge - width and x position change
              const newWidth = Math.max(50, Math.round(initialWidth + (initialX - svgP.x)));
              newLayer.x = initialX + (initialWidth - newWidth);
              newLayer.width = newWidth;
            } else if (handle === 's') {
              // Bottom edge - only height changes
              newLayer.height = Math.max(20, Math.round(svgP.y - initialY));
            } else if (handle === 'n') {
              // Top edge - height and y position change
              const newHeight = Math.max(20, Math.round(initialHeight + (initialY - svgP.y)));
              newLayer.y = initialY + (initialHeight - newHeight);
              newLayer.height = newHeight;
            } else if (handle === 'nw') {
              // Top-left corner
              const newWidth = Math.max(50, Math.round(initialWidth + (initialX - svgP.x)));
              const newHeight = Math.max(20, Math.round(initialHeight + (initialY - svgP.y)));
              newLayer.x = initialX + (initialWidth - newWidth);
              newLayer.y = initialY + (initialHeight - newHeight);
              newLayer.width = newWidth;
              newLayer.height = newHeight;
            } else if (handle === 'ne') {
              // Top-right corner
              const newWidth = Math.max(50, Math.round(svgP.x - initialX));
              const newHeight = Math.max(20, Math.round(initialHeight + (initialY - svgP.y)));
              newLayer.width = newWidth;
              newLayer.y = initialY + (initialHeight - newHeight);
              newLayer.height = newHeight;
            } else if (handle === 'sw') {
              // Bottom-left corner
              const newWidth = Math.max(50, Math.round(initialWidth + (initialX - svgP.x)));
              const newHeight = Math.max(20, Math.round(svgP.y - initialY));
              newLayer.x = initialX + (initialWidth - newWidth);
              newLayer.width = newWidth;
              newLayer.height = newHeight;
            } else if (handle === 'se') {
              // Bottom-right corner
              newLayer.width = Math.max(50, Math.round(svgP.x - initialX));
              newLayer.height = Math.max(20, Math.round(svgP.y - initialY));
            }
          }

          // Handle text layer font size adjustments
          if (l.type === 'text' && newLayer.type === 'text') {
            if (handle === 'e' || handle === 'w') {
              // Horizontal resize - adjust font size based on width only
              newLayer.size = Math.max(12, Math.round(newLayer.width * 0.4));
            } else if (handle === 'n' || handle === 's') {
              // Vertical resize - adjust font size based on height only
              newLayer.size = Math.max(12, Math.round(newLayer.height * 0.8));
            } else {
              // Corner resize - use the smaller of width/height based scaling
              const sizeFromWidth = Math.round(newLayer.width * 0.4);
              const sizeFromHeight = Math.round(newLayer.height * 0.8);
              newLayer.size = Math.max(12, Math.min(sizeFromWidth, sizeFromHeight));
            }
          }

          // Round all values for clean numbers
          newLayer.x = Math.round(newLayer.x);
          newLayer.y = Math.round(newLayer.y);
          newLayer.width = Math.round(newLayer.width);
          newLayer.height = Math.round(newLayer.height);
          return newLayer;
        })
      );
    },
    [resizeState]
  );
  const handleDragEnd = useCallback((): void => {
    setDraggedLayer(null);
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);

  const addNewLayer = useCallback((type: 'text' | 'image' | 'shape'): void => {
    setLayers((prev: Layer[]) => {
      const name = getUniqueLayerName(prev, type);
      const baseLayer = {
        id: `layer_${Date.now()}`,
        name,
        x: 100,
        y: 100,
        visible: true,
        borderWidth: 0,
        borderColor: '#000000',
        lockAspectRatio: false,
        opacity: 1
      };
      let newLayer: Layer;
      if (type === 'text') {
        newLayer = {
          ...baseLayer,
          type: 'text',
          width: 200,
          height: 40,
          text: 'New Text',
          font: 'Arial',
          size: 36,
          color: '#000000',
          bold: false,
          italic: false,
          useBackground: false,
          backgroundColor: '#ffffff',
          bgPadding: 4
        };
      } else if (type === 'image') {
        newLayer = {
          ...baseLayer,
          type: 'image',
          width: 200,
          height: 200,
          src: '',
          useColorFill: false,
          fillColor: '#cccccc'
        };
      } else {
        newLayer = {
          ...baseLayer,
          type: 'shape',
          width: 100,
          height: 100,
          fillColor: '#cccccc',
          strokeWidth: 2,
          strokeColor: '#000000'
        };
      }
      return [newLayer, ...prev];
    });
  }, []);

  const duplicateLayer = useCallback((layer: Layer): void => {
    setLayers((prev: Layer[]) => {
      const newName = getUniqueLayerName(prev, layer.type);
      const newLayer: Layer = { ...layer, id: `layer_${Date.now()}`, name: newName };
      return [newLayer, ...prev];
    });
  }, []);

  const [layerNameInput, setLayerNameInput] = useState<string>(
    selectedLayer ? selectedLayer.name : ''
  );
  const originalLayerNameRef = useRef<string>(
    selectedLayer ? selectedLayer.name : ''
  );
  useEffect(() => {
    if (selectedLayer) {
      setLayerNameInput(selectedLayer.name);
      originalLayerNameRef.current = selectedLayer.name;
    }
  }, [selectedLayer]);

  const importFileRef = useRef<HTMLInputElement>(null);
  const handleImportFile = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
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
        } catch {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const exportPlaceholderData = useCallback(() => ({
    canvasWidth,
    canvasHeight,
    backgroundImage: backgroundImage ? '[Background Image]' : null,
    layers: layers.map((layer: Layer) => {
      if (layer.type === 'image') {
        return {
          ...layer,
          src: layer.src ? `[Image: ${layer.name || 'unnamed image'}]` : ''
        };
      }
      return layer;
    })
  }), [canvasWidth, canvasHeight, layers, backgroundImage]);

  const handleExport = useCallback((): void => {
    const exportData = JSON.stringify(exportPlaceholderData(), null, 2);
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

  const handleExportPNG = useCallback((): void => {
    if (!svgRef.current) return;
    const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
    clonedSvg.removeAttribute('style');
    clonedSvg.setAttribute('width', String(canvasWidth));
    clonedSvg.setAttribute('height', String(canvasHeight));
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

  // --- Canvas Size Input Handlers ---
  const handleCanvasWidthChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setCanvasWidthInput(value); // Keep input state always updated
    const parsed = parseInt(value, 10);
    // Update main state immediately if valid positive number
    if (!isNaN(parsed) && parsed > 0) {
      setCanvasWidth(parsed);
      // If preset was selected, clear it if user types custom dimensions
      if (preset !== '') setPreset('');
    }
  };

  const handleCanvasWidthBlur = (): void => {
    const parsed = parseInt(canvasWidthInput, 10);
    // On blur, ensure the input reflects the actual valid state
    if (isNaN(parsed) || parsed <= 0) {
      setCanvasWidthInput(String(canvasWidth)); // Reset to last valid width
    } else {
      setCanvasWidthInput(String(parsed)); // Ensure input matches parsed value if valid
      setCanvasWidth(parsed); // Ensure state is set if changed just before blur
    }
  };

  const handleCanvasHeightChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setCanvasHeightInput(value); // Keep input state always updated
    const parsed = parseInt(value, 10);
    // Update main state immediately if valid positive number
    if (!isNaN(parsed) && parsed > 0) {
      setCanvasHeight(parsed);
      // If preset was selected, clear it if user types custom dimensions
      if (preset !== '') setPreset('');
    }
  };

  const handleCanvasHeightBlur = (): void => {
    const parsed = parseInt(canvasHeightInput, 10);
    // On blur, ensure the input reflects the actual valid state
    if (isNaN(parsed) || parsed <= 0) {
      setCanvasHeightInput(String(canvasHeight)); // Reset to last valid height
    } else {
      setCanvasHeightInput(String(parsed)); // Ensure input matches parsed value if valid
      setCanvasHeight(parsed); // Ensure state is set if changed just before blur
    }
  };

  const handlePresetChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    setPreset(value);
    if (value && value !== 'custom') { // Handle empty or 'custom' value explicitly if needed
      const [w, h] = value.split('x').map((v) => parseInt(v, 10));
      if (!isNaN(w) && !isNaN(h)) {
        setCanvasWidth(w);
        setCanvasHeight(h);
        // *** IMPORTANT: Update input fields as well ***
        setCanvasWidthInput(String(w));
        setCanvasHeightInput(String(h));
      }
    }
  };

  // Effect to update preset value when dimensions change externally or via input
  useEffect(() => {
    const matchingPreset = canvasPresets.find(p => p.value === `${canvasWidth}x${canvasHeight}`);
    setPreset(matchingPreset ? matchingPreset.value : '');
  }, [canvasWidth, canvasHeight]);

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

  const handleSelectLayer = (id: string) => {
    setActiveLayerId(id);
    setSelectedLayerId(id);
  };

  const handleToggleAspectRatio = useCallback(() => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === selectedLayer?.id ? { ...l, lockAspectRatio: !l.lockAspectRatio } : l
      )
    );
  }, [selectedLayer]);

  return (
    <div className="flex gap-4 p-4 w-full">
      <div className="flex flex-col gap-4 w-80">
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-2">Canvas Settings</h3>
          <div className="mb-2">
            <label className="block text-sm font-medium">Template Presets</label>
            <select
              aria-label="Select preset size"
              value={preset}
              onChange={handlePresetChange}
              className="mt-1 block w-full border-gray-300 rounded-md"
            >
              {canvasPresets.map((option) => (
                <option key={option.value || 'custom-key'} value={option.value}> {/* Ensure unique key */}
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Canvas Width</label>
            <input
              aria-label="Canvas width"
              title="Canvas width in pixels"
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
              aria-label="Canvas height"
              title="Canvas height in pixels"
              type="number"
              value={canvasHeightInput}
              onChange={handleCanvasHeightChange}
              onBlur={handleCanvasHeightBlur}
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
        </Card>
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
          <div ref={layersContainerRef}>
            <LayerList
              layers={layers}
              onSelectLayer={handleSelectLayer}
              onToggleVisibility={(id: string) =>
                setLayers((prev) =>
                  prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
                )
              }
              onDuplicate={duplicateLayer}
              onDelete={(layer: Layer) => {
                if (selectedLayerId === layer.id) setSelectedLayerId(null);
                setLayers((prev) => prev.filter((l) => l.id !== layer.id));
              }}
              onDragStart={handleLayerDragStart}
              onDragEnd={() => setDraggedLayerIndex(null)}
              onDragOver={handleContainerDragOver}
              onDrop={handleContainerDrop}
              onDragLeave={handleContainerDragLeave}
              activeLayerId={activeLayerId}
              dropIndicatorTop={dropIndicatorTop}
            />
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
      <div className="flex-1">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Preview</h2>
            <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
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
              </div>
              <input
                type="file"
                accept="application/json"
                ref={importFileRef}
                onChange={handleImportFile}
                style={{ display: 'none' }}
                aria-label="Import template JSON file"
              />
            </div>
          </div>
          <div className={styles.previewContainer}>
            <div className={styles.svgContainer}>
              <CanvasPreview
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                layers={layers}
                textBBoxes={textBBoxes}
                zoom={zoom}
                selectedLayerId={selectedLayerId}
                isEditable={!renderOnly}
                onMouseMove={(e: React.MouseEvent<Element>) => {
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
                handleDragStart={handleDragStart}
                handleResizeStart={handleResizeStart}
                updateTextBBox={updateTextBBox}
                svgRef={svgRef}
                backgroundImage={backgroundImage}
              />
            </div>
          </div>
        </Card>
      </div>
      <div className="w-64 flex-shrink-0">
        {selectedLayer ? (
          <Card className="p-4">
            <LayerProperties
              selectedLayer={selectedLayer}
              layerNameInput={layerNameInput}
              onLayerNameChange={(value: string) => setLayerNameInput(value)}
              onLayerNameBlur={() => {
                const duplicate = layers.find(
                  (l) => l.name === layerNameInput && l.id !== selectedLayer.id
                );
                if (duplicate) {
                  alert('Error: A layer with that name already exists.');
                  setLayerNameInput(originalLayerNameRef.current);
                } else {
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === selectedLayer.id ? { ...l, name: layerNameInput } : l
                    )
                  );
                  originalLayerNameRef.current = layerNameInput;
                }
              }}
              onTextChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, text: value }
                      : l
                  )
                )
              }
              onFontChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) => (l.id === selectedLayer.id ? { ...l, font: value } : l))
                )
              }
              onFontSizeChange={(value: number) =>
                setLayers((prev) =>
                  prev.map((l) => (l.id === selectedLayer.id ? { ...l, size: value } : l))
                )
              }
              onColorChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) => (l.id === selectedLayer.id ? { ...l, color: value } : l))
                )
              }
              onToggleBold={() =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, bold: !l.bold }
                      : l
                  )
                )
              }
              onToggleItalic={() =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, italic: !l.italic }
                      : l
                  )
                )
              }
              onToggleBackground={(checked: boolean) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, useBackground: checked }
                      : l
                  )
                )
              }
              onBackgroundColorChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, backgroundColor: value }
                      : l
                  )
                )
              }
              onBackgroundPaddingChange={(value: number) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, bgPadding: value }
                      : l
                  )
                )
              }
              onLayerWidthChange={(value: string) => setLayerWidthInput(value)}
              onLayerHeightChange={(value: string) => setLayerHeightInput(value)}
              onLayerWidthBlur={() => {
                const newWidth = parseInt(layerWidthInput, 10);
                if (!isNaN(newWidth) && newWidth > 0) {
                  setLayers((prev) =>
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
              onLayerHeightBlur={() => {
                const newHeight = parseInt(layerHeightInput, 10);
                if (!isNaN(newHeight) && newHeight > 0) {
                  setLayers((prev) =>
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
              layerXInput={layerXInput}
              layerYInput={layerYInput}
              onLayerXChange={(value: string) => setLayerXInput(value)}
              onLayerYChange={(value: string) => setLayerYInput(value)}
              onLayerXBlur={() => {
                const newX = parseInt(layerXInput, 10);
                if (!isNaN(newX)) {
                  setLayers((prev) =>
                    prev.map((l) => (l.id === selectedLayer.id ? { ...l, x: newX } : l))
                  );
                  setLayerXInput(String(newX));
                } else {
                  setLayerXInput(String(selectedLayer.x));
                }
              }}
              onLayerYBlur={() => {
                const newY = parseInt(layerYInput, 10);
                if (!isNaN(newY)) {
                  setLayers((prev) =>
                    prev.map((l) => (l.id === selectedLayer.id ? { ...l, y: newY } : l))
                  );
                  setLayerYInput(String(newY));
                } else {
                  setLayerYInput(String(selectedLayer.y));
                }
              }}
              onImageUrlChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'image' ? { ...l, src: value } : l
                  )
                )
              }
              onFileChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    const { dataUrl } = await resizeImage(file);
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === selectedLayer?.id ? { ...l, src: dataUrl } : l
                      )
                    );
                  } catch {
                    console.error('Error processing image:');
                  }
                }
              }}
              onToggleColorFill={(checked: boolean) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'image'
                      ? { ...l, useColorFill: checked }
                      : l
                  )
                )
              }
              onFillColorChange={(value: string) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'image'
                      ? { ...l, fillColor: value }
                      : l
                  )
                )
              }
              onToggleAspectRatio={handleToggleAspectRatio}
              onAlignHorizontally={(direction: 'left' | 'center' | 'right') => {
                if (!selectedLayer) return;
                const getLayerBBox = (layer: Layer): BoundingBox => {
                  if (layer.type === 'text' && textBBoxes[layer.id]) {
                    return textBBoxes[layer.id];
                  }
                  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
                };
                const selectedBBox = getLayerBBox(selectedLayer);
                let targetBBox: BoundingBox;
                if (alignTargetLayerId) {
                  const targetLayer = layers.find((l) => l.id === alignTargetLayerId);
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
                    (targetBBox.x + targetBBox.width / 2) -
                    (selectedBBox.x + selectedBBox.width / 2);
                } else if (direction === 'right') {
                  deltaX = (targetBBox.x + targetBBox.width) - (selectedBBox.x + selectedBBox.width);
                }
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id ? { ...l, x: Math.round(l.x + deltaX) } : l
                  )
                );
              }}
              onAlignVertically={(direction: 'top' | 'middle' | 'bottom') => {
                if (!selectedLayer) return;
                const getLayerBBox = (layer: Layer): BoundingBox => {
                  if (layer.type === 'text' && textBBoxes[layer.id]) {
                    return textBBoxes[layer.id];
                  }
                  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
                };
                const selectedBBox = getLayerBBox(selectedLayer);
                let targetBBox: BoundingBox;
                if (alignTargetLayerId) {
                  const targetLayer = layers.find((l) => l.id === alignTargetLayerId);
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
                    (targetBBox.y + targetBBox.height / 2) -
                    (selectedBBox.y + selectedBBox.height / 2);
                } else if (direction === 'bottom') {
                  deltaY = (targetBBox.y + targetBBox.height) - (selectedBBox.y + selectedBBox.height);
                }
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id ? { ...l, y: Math.round(l.y + deltaY) } : l
                  )
                );
              }}
              alignTargetLayerId={alignTargetLayerId}
              onAlignTargetChange={(value: string) => setAlignTargetLayerId(value)}
              layersForAlignment={layers.filter((l) => l.id !== selectedLayer.id)}
              layerWidthInput={layerWidthInput}
              layerHeightInput={layerHeightInput}
            />
          </Card>
        ) : (
          <Card className="p-4">
            <h3 className="text-lg font-bold">No Layer Selected</h3>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TemplateEditor;
