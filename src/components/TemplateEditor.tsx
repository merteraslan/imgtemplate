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
import { Image as ImageIcon, Type, Download, FileImage, CloudLightning } from 'lucide-react';

import styles from './TemplateEditor.module.css';
import {
  Layer,
  TemplateData,
  BoundingBox,
  ImageLayer
} from '../types/templateTypes';
import {
  resizeImage,
  fetchExternalImageAsDataURL, // Import for direct use in editor
  exportSvgToPng
} from '../utils/imageUtils';
import { downloadImageFromAPI } from '../utils/apiUtils'; // Import API utility
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

// Interface for the shape of the state saved to localStorage
interface SavedState {
  canvasWidth?: number;
  canvasHeight?: number;
  layers?: Partial<Layer>[]; // Use Partial<Layer> to allow for potentially incomplete data
  backgroundImage?: string | null;
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
      'https://images.unsplash.com/photo-1603036050141-c61fde866f5c?auto=format&fit=crop&q=80',
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
        lockAspectRatio: true,
        effect: 'none',
        cornerRadius: 0
      }
    ]
  };

  const effectiveTemplateData = jsonData || defaultTemplateData;

  // Initialize layers
  const initializeLayers = useCallback(() => {
    // Just use the layers from the template or default, background is handled separately
    return effectiveTemplateData.layers || [];
  }, [effectiveTemplateData]);

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
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    effectiveTemplateData.backgroundImage || null
  );

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

  // Drag state for canvas elements (layers, resize handles)
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

  // --- Image URL Processing ---

  // Ref to track URLs currently being processed to prevent race conditions/duplicates
  const processingUrlsRef = useRef<Set<string>>(new Set());

  // Effect to automatically fetch and convert http(s) URLs in image layers to data URLs
  useEffect(() => {
    const processImageUrls = async () => {
      // Find layers that have an http(s) src, are not already loading/errored, and not currently being processed
      const layersToProcess = layers.filter(layer =>
        layer.type === 'image' &&
        (layer as ImageLayer).src &&
        (layer as ImageLayer).src.startsWith('http') &&
        !(layer as ImageLayer)._isLoading &&
        !(layer as ImageLayer)._error &&
        !processingUrlsRef.current.has(layer.id)
      );

      if (layersToProcess.length === 0) {
        return; // Nothing to process
      }

      // Mark layers as 'processing' in the ref and set loading state
      layersToProcess.forEach(layer => processingUrlsRef.current.add(layer.id));

      setLayers(prevLayers => {
        return prevLayers.map(l => {
          if (layersToProcess.some(p => p.id === l.id) && l.type === 'image') {
            return {
              ...l,
              _isLoading: true,
              _error: undefined // use undefined instead of null
            } as ImageLayer;
          }
          return l;
        });
      });

      // Process each URL
      const results = await Promise.allSettled(layersToProcess.map(async (layer) => {
        if (layer.type === 'image' && (layer as ImageLayer).src) { // Type guard
          try {
            const dataUrl = await fetchExternalImageAsDataURL((layer as ImageLayer).src);
            return { id: layer.id, success: true, src: dataUrl };
          } catch (error) {
            console.error(`Failed to convert URL for layer ${layer.id}:`, error);
            return {
              id: layer.id,
              success: false,
              error: `Failed to load image. ${error instanceof Error ? error.message : String(error)}`,
              originalSrc: (layer as ImageLayer).src
            };
          }
        }
        throw new Error("Invalid layer type for processing"); // Should not happen
      }));

      // Update state based on processing results
      setLayers(prevLayers => {
        const newLayers = [...prevLayers]; // Create mutable copy
        let stateChanged = false;

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { id, success, src, error, originalSrc } = result.value;
            const layerIndex = newLayers.findIndex(l => l.id === id);

            if (layerIndex !== -1 && newLayers[layerIndex].type === 'image') {
              processingUrlsRef.current.delete(id); // Mark as done
              const currentLayer = newLayers[layerIndex] as ImageLayer;

              // Only update if the src hasn't changed since processing started
              if (currentLayer.src === originalSrc || success) {
                newLayers[layerIndex] = {
                  ...currentLayer,
                  src: success ? src : (originalSrc || ''), // Use dataURL on success, keep original on error
                  _isLoading: false,
                  _error: success ? undefined : error, // use undefined instead of null
                } as ImageLayer;
                stateChanged = true;
              } else {
                // Src changed during processing, just remove loading flag
                newLayers[layerIndex] = {
                  ...currentLayer,
                  _isLoading: false
                } as ImageLayer;
                stateChanged = true;
              }
            }
          } else { // Handle rejected promises (less likely with allSettled)
            // Log the error, potentially find layer ID if possible in `reason`
            console.error("Image processing promise rejected:", result.reason);
            // Attempt to find layer and mark error? This part is tricky.
            // For now, rely on fulfilled status with success: false
          }
        });

        // Final check: Clear flags for non-http layers if they got stuck
        newLayers.forEach((l, index) => {
          if (l.type === 'image' && !(l as ImageLayer).src?.startsWith('http')) {
            const imageLayer = l as ImageLayer;
            if (imageLayer._isLoading || imageLayer._error) {
              if (!processingUrlsRef.current.has(l.id)) { // Only clear if not currently processing
                newLayers[index] = {
                  ...l,
                  _isLoading: false,
                  _error: undefined
                } as ImageLayer;
                stateChanged = true;
              }
            }
          }
        });

        return stateChanged ? newLayers : prevLayers; // Return new array only if changed
      });
    };

    processImageUrls();

    // Dependency: run when the layers array *identity* changes.
    // Avoid depending on mutable refs like processingUrlsRef.current here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

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
    setResizeState(null); // Also clear resize state
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
          textAlign: 'left',
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
          fillColor: '#cccccc',
          effect: 'none',
          cornerRadius: 0
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
      reader.onload = async (ev) => {
        try {
          // Clear existing layers and selection before importing
          setLayers([]);
          setSelectedLayerId(null);

          // Now process the imported data
          const data = JSON.parse(ev.target?.result as string);

          // Process layers to handle placeholder texts
          if (data.layers) {
            const processedLayers = data.layers.map((layer: Layer) => {
              if (layer.type === 'image') {
                // Create a new object with processed properties
                return {
                  ...layer,
                  // Handle image src placeholders
                  src: typeof layer.src === 'string' && layer.src.startsWith('[Image:') ? '' : layer.src,
                  // Ensure cornerRadius is set to 0 for backward compatibility
                  cornerRadius: layer.cornerRadius === undefined ? 0 : layer.cornerRadius
                };
              }
              return layer;
            });
            setLayers(processedLayers);
          } else {
            setLayers([]);
          }

          if (data.canvasWidth) {
            setCanvasWidth(data.canvasWidth);
            setCanvasWidthInput(String(data.canvasWidth));
          }
          if (data.canvasHeight) {
            setCanvasHeight(data.canvasHeight);
            setCanvasHeightInput(String(data.canvasHeight));
          }

          // Handle background image, removing placeholder text
          if (data.backgroundImage && data.backgroundImage !== '[Background Image]') {
            setBackgroundImage(data.backgroundImage);
          } else {
            setBackgroundImage(null);
          }
        } catch (error) {
          console.error('Error importing JSON:', error);
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const exportPlaceholderData = useCallback(() => ({
    canvasWidth,
    canvasHeight,
    backgroundImage: backgroundImage ? backgroundImage : null,
    layers: layers.map((layer: Layer) => {
      // First check the layer type
      if (layer.type === 'image') {
        // Handle image layers - remove transient UI state fields
        const imageLayer = layer as ImageLayer;

        // Create a clean copy of the layer without the transient properties
        const cleanedLayer: ImageLayer = {
          id: imageLayer.id,
          name: imageLayer.name,
          type: 'image',
          x: imageLayer.x,
          y: imageLayer.y,
          width: imageLayer.width,
          height: imageLayer.height,
          visible: imageLayer.visible,
          borderWidth: imageLayer.borderWidth,
          borderColor: imageLayer.borderColor,
          lockAspectRatio: imageLayer.lockAspectRatio,
          opacity: imageLayer.opacity,
          src: imageLayer.src && !imageLayer.src.startsWith('[Image:') ? imageLayer.src : '',
          useColorFill: imageLayer.useColorFill,
          fillColor: imageLayer.fillColor,
          effect: imageLayer.effect,
          cornerRadius: imageLayer.cornerRadius
        };

        return cleanedLayer;
      }

      // For other layer types, return as is - they don't have the transient state
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

  const handleExportPNG = useCallback(async (): Promise<void> => {
    if (!svgRef.current) return;

    try {
      // Use the new utility function for export
      const pngDataUrl = await exportSvgToPng(
        svgRef.current,
        canvasWidth,
        canvasHeight,
        layers // Pass the actual layers data 
      );

      // Create download link
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = 'template.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export PNG. Please ensure all images are properly loaded.');
    }
  }, [canvasWidth, canvasHeight, layers, backgroundImage]);

  // API-based image generation handler
  const handleExportPNGViaAPI = useCallback(async (): Promise<void> => {
    try {
      // Get template data from current state
      const templateData = exportPlaceholderData();

      // Use the API utility to download the image
      await downloadImageFromAPI(templateData, 'template-api.png');
    } catch (error) {
      console.error('Error generating image via API:', error);
      alert('Failed to generate image via API. Please try again.');
    }
  }, [exportPlaceholderData]);

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

  // Effect to SAVE state to localStorage whenever relevant state changes
  useEffect(() => {
    const stateToSave: SavedState = {
      canvasWidth,
      canvasHeight,
      layers,
      backgroundImage
    };
    localStorage.setItem('templateEditorState', JSON.stringify(stateToSave));
  }, [canvasWidth, canvasHeight, layers, backgroundImage]);

  // Helper function to validate and sanitize numbers (reusable)
  const sanitizeNumber = (value: unknown, defaultValue = 0, allowZero = true, min?: number, max?: number): number => {
    let num = Number(value);
    if (isNaN(num) || !isFinite(num) || (!allowZero && num === 0)) {
      num = defaultValue;
    }
    if (min !== undefined) num = Math.max(min, num);
    if (max !== undefined) num = Math.min(max, num);
    return num;
  };

  // Helper function to validate a single layer (takes Partial<Layer>, returns type predicate)
  const isValidLayer = (layer: Partial<Layer>): layer is Layer => {
    if (!layer || typeof layer !== 'object' || !layer.id || !layer.type) return false;

    // Sanitize and assign values, ensuring they exist on the object
    layer.x = sanitizeNumber(layer.x, 0);
    layer.y = sanitizeNumber(layer.y, 0);
    layer.width = sanitizeNumber(layer.width, 50, true, 1); // Min width 1
    layer.height = sanitizeNumber(layer.height, 20, true, 1); // Min height 1
    layer.opacity = sanitizeNumber(layer.opacity, 1, true, 0, 1); // Opacity 0-1
    layer.borderWidth = sanitizeNumber(layer.borderWidth, 0, true, 0);
    layer.lockAspectRatio = !!layer.lockAspectRatio;
    layer.visible = layer.visible !== undefined ? !!layer.visible : true; // Default visible to true if undefined

    // Ensure required string properties exist and are strings
    if (typeof layer.name !== 'string') layer.name = `Layer ${layer.id.substring(0, 4)}`; // Default name

    // Type-specific validation
    if (layer.type === 'text') {
      layer.size = sanitizeNumber(layer.size, 12, false, 1); // Min size 1, non-zero
      layer.bgPadding = sanitizeNumber(layer.bgPadding, 0, true, 0);
      if (typeof layer.text !== 'string') layer.text = 'Invalid Text';
      if (typeof layer.font !== 'string') layer.font = 'Arial';
      if (typeof layer.color !== 'string') layer.color = '#000000';
      if (typeof layer.backgroundColor !== 'string') layer.backgroundColor = '#ffffff'; // Default background color
      layer.bold = !!layer.bold;
      layer.italic = !!layer.italic;
      layer.useBackground = !!layer.useBackground;
      if (layer.textAlign && !['left', 'center', 'right'].includes(layer.textAlign)) {
        layer.textAlign = 'left';
      }
      // Check if all required properties for TextLayer exist after potential sanitization
      return typeof layer.text === 'string' &&
        typeof layer.font === 'string' &&
        typeof layer.size === 'number' &&
        typeof layer.color === 'string' &&
        typeof layer.backgroundColor === 'string' && // Added check
        typeof layer.bgPadding === 'number' && // Added check
        typeof layer.bold === 'boolean' && // Added check
        typeof layer.italic === 'boolean' && // Added check
        typeof layer.useBackground === 'boolean'; // Added check

    } else if (layer.type === 'image') {
      if (typeof layer.src !== 'string') layer.src = '';
      if (typeof layer.fillColor !== 'string') layer.fillColor = '#cccccc';
      layer.useColorFill = !!layer.useColorFill;
      // Make sure effect property is valid - default to 'none'
      if (layer.effect === undefined || layer.effect === null) layer.effect = 'none';
      // Ensure cornerRadius is a valid number - explicitly set to 0 if undefined
      layer.cornerRadius = layer.cornerRadius === undefined ? 0 : sanitizeNumber(layer.cornerRadius, 0, true, 0);
      // Check if all required properties for ImageLayer exist
      return typeof layer.src === 'string' &&
        typeof layer.fillColor === 'string' &&
        typeof layer.useColorFill === 'boolean' &&
        typeof layer.cornerRadius === 'number' &&
        (layer.effect === null || ['none', 'dots', 'lines', 'waves', 'grid', 'checkerboard'].includes(layer.effect));

    } else if (layer.type === 'shape') {
      layer.strokeWidth = sanitizeNumber(layer.strokeWidth, 0, true, 0);
      if (typeof layer.fillColor !== 'string') layer.fillColor = '#cccccc';
      if (typeof layer.strokeColor !== 'string') layer.strokeColor = '#000000';
      // Check if all required properties for ShapeLayer exist
      return typeof layer.fillColor === 'string' &&
        typeof layer.strokeColor === 'string' &&
        typeof layer.strokeWidth === 'number';

    } else {
      // Unknown layer type
      return false;
    }
  };

  // Effect to LOAD state from localStorage ON MOUNT
  useEffect(() => {
    const saved = localStorage.getItem('templateEditorState');
    if (saved) {
      try {
        const state: SavedState = JSON.parse(saved);

        // Validate and sanitize canvas dimensions
        const initialWidth = sanitizeNumber(state.canvasWidth, width, false, 10);
        const initialHeight = sanitizeNumber(state.canvasHeight, height, false, 10);
        setCanvasWidth(initialWidth);
        setCanvasWidthInput(String(initialWidth));
        setCanvasHeight(initialHeight);
        setCanvasHeightInput(String(initialHeight));

        // Validate and sanitize layers
        if (Array.isArray(state.layers)) {
          // Process layers for backward compatibility
          const processedLayers = state.layers.map(layer => {
            // Ensure image layers have cornerRadius property for backward compatibility
            if (layer.type === 'image' && layer.cornerRadius === undefined) {
              return { ...layer, cornerRadius: 0 };
            }
            return layer;
          });

          const validLayers = processedLayers.filter(isValidLayer);
          if (validLayers.length !== state.layers.length) {
            console.warn('Some layers from localStorage were invalid and have been removed or sanitized.');
          }
          // Explicitly cast to Layer[] because filter with type predicate should guarantee this
          setLayers(validLayers as Layer[]);
        } else {
          console.warn('No valid layers array found in localStorage.');
          setLayers([]); // Set to empty array if layers are not an array
        }

        setBackgroundImage(typeof state.backgroundImage === 'string' ? state.backgroundImage : null);

      } catch (e) {
        console.error('Error loading or validating state from localStorage:', e);
        // Fallback to initial props/defaults if loading/validation fails
        setCanvasWidth(width);
        setCanvasWidthInput(String(width));
        setCanvasHeight(height);
        setCanvasHeightInput(String(height));
        setLayers(initializeLayers()); // Use callback to get initial layers
        setBackgroundImage(effectiveTemplateData.backgroundImage || null);
      }
    } else {
      // No saved state, set input fields based on initial state derived from props/defaults
      setCanvasWidthInput(String(canvasWidth));
      setCanvasHeightInput(String(canvasHeight));
    }
    // This effect should run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <--- Correct empty dependency array

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

  // Add handler for background image URL change
  const handleBackgroundImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setBackgroundImage(e.target.value);
  };
  const handleClearBackgroundImage = () => {
    setBackgroundImage(null);
  };

  // Add the handler for effect change
  const handleEffectChange = useCallback(
    (value: 'none' | 'dots' | 'lines' | 'waves' | 'grid' | 'checkerboard' | null): void => {
      if (!selectedLayer || selectedLayer.type !== 'image') return;
      setLayers((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === selectedLayer.id
            ? { ...layer, effect: value } as ImageLayer
            : layer
        )
      );
    },
    [selectedLayer]
  );

  // Add the handler for corner radius change
  const handleCornerRadiusChange = useCallback(
    (value: number): void => {
      if (!selectedLayer || selectedLayer.type !== 'image') return;
      setLayers((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === selectedLayer.id
            ? { ...layer, cornerRadius: value } as ImageLayer
            : layer
        )
      );
    },
    [selectedLayer]
  );

  // Add the handler for border width change
  const handleBorderWidthChange = useCallback(
    (value: number): void => {
      if (!selectedLayer) return;
      setLayers((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === selectedLayer.id
            ? { ...layer, borderWidth: value }
            : layer
        )
      );
    },
    [selectedLayer]
  );

  // Add the handler for border color change
  const handleBorderColorChange = useCallback(
    (value: string): void => {
      if (!selectedLayer) return;
      setLayers((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === selectedLayer.id
            ? { ...layer, borderColor: value }
            : layer
        )
      );
    },
    [selectedLayer]
  );

  return (
    <div className="flex gap-4 p-4 w-full h-[calc(100vh-4rem)]"> {/* Adjust height as needed */}
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
          {/* Background Image Control */}
          <div className="mb-2">
            <label className="block text-sm font-medium">Background Image URL (Optional)</label>
            <input
              type="url"
              placeholder="Enter image URL"
              value={backgroundImage || ''}
              onChange={handleBackgroundImageChange}
              className="mt-1 block w-full border-gray-300 rounded-md text-xs"
              aria-label="Background image URL"
            />
            {backgroundImage && (
              <button
                onClick={handleClearBackgroundImage}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Clear Background
              </button>
            )}
          </div>
        </Card>
        <Card className="p-4 flex-1 overflow-y-auto">
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
      <div className="flex-1 flex flex-col">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4 px-4 pt-4">
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
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded"
                  onClick={handleExportPNGViaAPI}
                  title="Export PNG via API"
                >
                  <CloudLightning size={20} />
                  API PNG
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
                }}
                onMouseLeave={() => {
                  handleDragEnd();
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
      <div className="w-64 flex-shrink-0 flex flex-col">
        {selectedLayer ? (
          <Card className="p-4 flex-1 overflow-y-auto">
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
              onTextAlignChange={(value: 'left' | 'center' | 'right') =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id && l.type === 'text'
                      ? { ...l, textAlign: value }
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
              onImageUrlChange={async (value: string) => {
                if (!selectedLayer || selectedLayer.type !== 'image') return;
                const layerId = selectedLayer.id;

                // If the value is an HTTP(S) URL, fetch and convert it
                if (value && value.startsWith('http')) {
                  // Set loading state immediately
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === layerId && l.type === 'image'
                        ? { ...l, src: value, _isLoading: true, _error: undefined }
                        : l
                    )
                  );

                  try {
                    const dataUrl = await fetchExternalImageAsDataURL(value);
                    // Update with data URL on success
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === layerId && l.type === 'image'
                          ? { ...l, src: dataUrl, _isLoading: false, _error: undefined, useColorFill: false }
                          : l
                      )
                    );
                  } catch (error) {
                    console.error(`Failed to convert URL for layer ${layerId}:`, error);
                    const errorMessage = `Failed to load image. ${error instanceof Error ? error.message : String(error)}`;
                    // Update with error state on failure, keep original URL for reference
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === layerId && l.type === 'image'
                          ? { ...l, src: value, _isLoading: false, _error: errorMessage, useColorFill: !value }
                          : l
                      )
                    );
                  }
                } else {
                  // If it's not an HTTP URL (empty, data URL, etc.), update directly
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === layerId && l.type === 'image'
                        ? { ...l, src: value, _isLoading: false, _error: undefined, useColorFill: !value }
                        : l
                    )
                  );
                }
              }}
              onFileChange={async (e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    const { dataUrl } = await resizeImage(file);
                    setLayers((prev) =>
                      prev.map((l) =>
                        l.id === selectedLayer?.id ? { ...l, src: dataUrl, useColorFill: false } : l
                      )
                    );
                  } catch {
                    console.error('Error processing image');
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
              onOpacityChange={(value: number) =>
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === selectedLayer.id ? { ...l, opacity: Math.max(0, Math.min(1, value)) } : l
                  )
                )
              }
              onEffectChange={handleEffectChange}
              onCornerRadiusChange={handleCornerRadiusChange}
              onBorderWidthChange={handleBorderWidthChange}
              onBorderColorChange={handleBorderColorChange}
            />
          </Card>
        ) : (
          <Card className="p-4 flex-shrink-0"> {/* Prevent empty card from collapsing */}
            <h3 className="text-lg font-bold">No Layer Selected</h3>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TemplateEditor;
