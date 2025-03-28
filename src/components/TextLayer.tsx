// components/TextLayer.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TextLayer as TextLayerType, BoundingBox } from '../types/templateTypes';

interface TextLayerProps {
  layer: TextLayerType;
  onDragStart: (e: React.MouseEvent, layer: TextLayerType) => void;
  updateBBox: (id: string, bbox: BoundingBox) => void;
  isEditable: boolean;
}

const TextLayer: React.FC<TextLayerProps> = ({ layer, onDragStart, updateBBox, isEditable }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [currentHeight, setCurrentHeight] = useState(layer.height);

  // Measure and report the actual BBox based on the rendered div
  useEffect(() => {
    let measuredHeight = layer.height; // Fallback to JSON height
    if (divRef.current) {
      measuredHeight = divRef.current.scrollHeight;
    }
    // Update local state for foreignObject height
    setCurrentHeight(measuredHeight);
    // Update parent state for background/border/selection box
    updateBBox(layer.id, {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: measuredHeight,
    });
    // Re-measure/update if relevant layer properties change
  }, [layer.id, layer.x, layer.y, layer.width, layer.height, layer.text, layer.size, layer.font, layer.italic, layer.bold, updateBBox]);

  // Style for the div inside foreignObject to handle wrapping and styling
  const divStyle: React.CSSProperties = {
    width: `${layer.width}px`,
    fontFamily: layer.font,
    fontSize: `${layer.size}px`,
    color: layer.color,
    fontStyle: layer.italic ? 'italic' : 'normal',
    fontWeight: layer.bold ? 'bold' : 'normal',
    textAlign: layer.textAlign || 'left',
    opacity: layer.opacity ?? 1,
    // Enable wrapping
    overflowWrap: 'break-word', // Standard property
    wordWrap: 'break-word',     // Older property for broader compatibility
    // Vertical alignment (using flexbox)
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start', // <-- Change to flex-start for top alignment
    // Prevent interaction with text selection inside, handle drag on foreignObject
    userSelect: 'none',
    pointerEvents: 'none', // Important: prevent div from capturing mouse events meant for foreignObject/SVG
    boxSizing: 'border-box', // Include padding/border in element's total width and height
    // Add padding if desired, e.g., padding: '5px',
  };

  return (
    <foreignObject
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={currentHeight}
      style={{
        cursor: isEditable ? 'move' : 'default',
        pointerEvents: 'auto',
        overflow: 'hidden', // Hide potential overflow due to scrollHeight inaccuracies
      }}
      onMouseDown={isEditable ? (e) => {
        // Prevent drag from starting on scrollbars if content overflows (though overflow should ideally be hidden/handled)
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onDragStart(e, layer);
        }
      } : undefined}
    >
      {/* Use namespace for XHTML elements within foreignObject */}
      {/* @ts-expect-error // Allow xmlns attribute necessary for foreignObject */}
      <div ref={divRef} xmlns="http://www.w3.org/1999/xhtml" style={divStyle}>
        {layer.text}
      </div>
    </foreignObject>
  );
};

export default TextLayer;
