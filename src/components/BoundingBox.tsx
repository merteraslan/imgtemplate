// components/BoundingBox.tsx
'use client';

import React from 'react';
import { BoundingBox as BoundingBoxType, Layer } from '../types/templateTypes';

interface BoundingBoxProps {
  layer: Layer;
  onResizeStart: (e: React.MouseEvent, layer: Layer, handle: string) => void;
  bbox?: BoundingBoxType;
}

const BoundingBox: React.FC<BoundingBoxProps> = React.memo(({ layer, onResizeStart, bbox }) => {
  const handleMouseDown = (e: React.MouseEvent, pos: string) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(e, layer, pos);
  };

  const box = bbox || {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height
  };

  // Ensure width and height are valid numbers >= 0, default to 0 if not
  const safeX = typeof box.x === 'number' && isFinite(box.x) ? box.x : 0;
  const safeY = typeof box.y === 'number' && isFinite(box.y) ? box.y : 0;
  const safeWidth = typeof box.width === 'number' && isFinite(box.width) && box.width >= 0 ? box.width : 0;
  const safeHeight = typeof box.height === 'number' && isFinite(box.height) && box.height >= 0 ? box.height : 0;

  // Prevent rendering if dimensions are invalid (optional, but good practice)
  // if (safeWidth <= 0 || safeHeight <= 0) {
  //   return null;
  // }

  return (
    <g>
      <rect
        x={safeX - 2}
        y={safeY - 2}
        width={safeWidth + 4}
        height={safeHeight + 4}
        fill="none"
        stroke="#00F"
        strokeWidth="1"
        strokeDasharray="4"
      />
      {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((pos) => (
        <circle
          key={pos}
          cx={
            safeX +
            (pos.includes('e')
              ? safeWidth
              : pos.includes('w')
                ? 0
                : safeWidth / 2) // Use safeWidth
          }
          cy={
            safeY +
            (pos.includes('s')
              ? safeHeight
              : pos.includes('n')
                ? 0
                : safeHeight / 2) // Use safeHeight
          }
          r="4"
          fill="#00F"
          style={{ cursor: `${pos}-resize`, userSelect: 'none' }}
          onMouseDown={(e) => handleMouseDown(e, pos)}
        />
      ))}
    </g>
  );
});
BoundingBox.displayName = 'BoundingBox';

export default BoundingBox;
