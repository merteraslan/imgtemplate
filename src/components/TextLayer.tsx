// components/TextLayer.tsx
'use client';

import React, { useRef, useLayoutEffect } from 'react';
import { TextLayer as TextLayerType, BoundingBox } from '../types/templateTypes';

interface TextLayerProps {
  layer: TextLayerType;
  onDragStart: (e: React.MouseEvent, layer: TextLayerType) => void;
  updateBBox: (id: string, bbox: BoundingBox) => void;
}

const TextLayer: React.FC<TextLayerProps> = ({ layer, onDragStart, updateBBox }) => {
  const textRef = useRef<SVGTextElement>(null);

  useLayoutEffect(() => {
    if (textRef.current) {
      const bbox = textRef.current.getBBox();
      updateBBox(layer.id, bbox);
    }
  }, [layer.id, layer.text, layer.font, layer.size, layer.x, layer.y, layer.italic, layer.bold, updateBBox]);

  return (
    <text
      ref={textRef}
      x={Math.round(layer.x)}
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

export default TextLayer;
