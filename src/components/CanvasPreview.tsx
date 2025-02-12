// components/CanvasPreview.tsx
'use client';

import React from 'react';
import { Layer, BoundingBox } from '../types/templateTypes';
import TextLayer from './TextLayer';
import BoundingBoxComponent from './BoundingBox';

interface CanvasPreviewProps {
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  textBBoxes: { [id: string]: BoundingBox };
  zoom: number;
  selectedLayerId: string | null;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  handleDragStart: (e: React.MouseEvent, layer: Layer) => void;
  handleResizeStart: (e: React.MouseEvent, layer: Layer, handle: string) => void;
  updateTextBBox: (id: string, bbox: BoundingBox) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  canvasWidth,
  canvasHeight,
  layers,
  textBBoxes,
  zoom,
  selectedLayerId,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  handleDragStart,
  handleResizeStart,
  updateTextBBox,
  svgRef
}) => {
  return (
    <div style={{ overflow: 'auto' }}>
      <svg
        ref={svgRef}
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <rect width={canvasWidth} height={canvasHeight} fill="#f0f0f0" />
        {layers
          .slice()
          .reverse()
          .filter((l: Layer) => l.visible)
          .map((layer: Layer) => (
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
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} bbox={textBBoxes[layer.id]} />
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
                        style={{ cursor: 'move' }}
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
                            layer.src && !layer.src.startsWith('data:') ? 'none' : 'xMidYMid meet'
                          }
                          opacity={layer.opacity ?? 1}
                          style={{ cursor: 'move' }}
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
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} />
                  )}
                </>
              )}
            </g>
          ))}
      </svg>
    </div>
  );
};

export default CanvasPreview;
