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
});
BoundingBox.displayName = 'BoundingBox';

export default BoundingBox;
