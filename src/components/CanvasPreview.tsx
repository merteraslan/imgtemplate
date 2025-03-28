// components/CanvasPreview.tsx
'use client';

import React from 'react';
import { Layer, BoundingBox, TextLayer as TextLayerType, ImageLayer } from '../types/templateTypes';
import TextLayer from './TextLayer';
import BoundingBoxComponent from './BoundingBox';

interface CanvasPreviewProps {
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  textBBoxes: { [id: string]: BoundingBox };
  zoom: number;
  selectedLayerId: string | null;
  isEditable?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  handleDragStart?: (e: React.MouseEvent, layer: Layer) => void;
  handleResizeStart?: (e: React.MouseEvent, layer: Layer, handle: string) => void;
  updateTextBBox: (id: string, bbox: BoundingBox) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  backgroundImage?: string | null;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  canvasWidth,
  canvasHeight,
  layers,
  textBBoxes,
  zoom,
  selectedLayerId,
  isEditable = true,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  handleDragStart,
  handleResizeStart,
  updateTextBBox,
  svgRef,
  backgroundImage
}) => {
  const commonSvgProps = {
    width: canvasWidth,
    height: canvasHeight,
    viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
    style: { transform: `scale(${zoom})`, transformOrigin: 'top left', border: isEditable ? '1px solid #e2e8f0' : 'none' },
    ...(isEditable && {
      onMouseMove: onMouseMove,
      onMouseUp: onMouseUp,
      onMouseLeave: onMouseLeave,
    })
  };

  return (
    <svg ref={svgRef} {...commonSvgProps}>
      {backgroundImage ? (
        <image
          href={backgroundImage}
          x={0} y={0}
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
        .filter((l: Layer) => l.visible)
        .map((layer: Layer) => (
          <g key={layer.id}>
            {layer.type === 'text' ? (() => {
              const textLayer = layer as TextLayerType;
              return (
                <>
                  {textLayer.useBackground && textBBoxes[layer.id] && (
                    <rect
                      x={textBBoxes[layer.id].x - textLayer.bgPadding}
                      y={textBBoxes[layer.id].y - textLayer.bgPadding}
                      width={textBBoxes[layer.id].width + 2 * textLayer.bgPadding}
                      height={textBBoxes[layer.id].height + 2 * textLayer.bgPadding}
                      fill={textLayer.backgroundColor}
                      opacity={textLayer.opacity ?? 1}
                    />
                  )}
                  <TextLayer
                    layer={textLayer}
                    onDragStart={isEditable && handleDragStart ? handleDragStart : () => { }}
                    updateBBox={updateTextBBox}
                    isEditable={isEditable}
                  />
                  {textLayer.borderWidth > 0 && textBBoxes[layer.id] && (
                    <rect
                      x={textBBoxes[layer.id].x}
                      y={textBBoxes[layer.id].y}
                      width={textBBoxes[layer.id].width}
                      height={textBBoxes[layer.id].height}
                      fill="none"
                      stroke={textLayer.borderColor}
                      strokeWidth={textLayer.borderWidth}
                    />
                  )}
                  {isEditable && selectedLayerId === layer.id && handleResizeStart && (
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} bbox={textBBoxes[layer.id]} />
                  )}
                </>
              );
            })() : null}

            {layer.type === 'image' ? (() => {
              const imageLayer = layer as ImageLayer;
              const imageMouseDownHandler = isEditable && handleDragStart ? (e: React.MouseEvent) => handleDragStart(e, layer) : undefined;
              return (
                <>
                  {imageLayer.useColorFill ? (
                    <rect
                      x={imageLayer.x}
                      y={imageLayer.y}
                      width={imageLayer.width}
                      height={imageLayer.height}
                      fill={imageLayer.fillColor}
                      opacity={imageLayer.opacity ?? 1}
                      style={{ cursor: isEditable ? 'move' : 'default' }}
                      onMouseDown={imageMouseDownHandler}
                    />
                  ) : (
                    imageLayer.src && (
                      <image
                        href={imageLayer.src}
                        x={imageLayer.x}
                        y={imageLayer.y}
                        width={imageLayer.width}
                        height={imageLayer.height}
                        preserveAspectRatio="none"
                        opacity={imageLayer.opacity ?? 1}
                        style={{ cursor: isEditable ? 'move' : 'default' }}
                        onMouseDown={imageMouseDownHandler}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )
                  )}
                  {imageLayer.borderWidth > 0 && (
                    <rect
                      x={imageLayer.x}
                      y={imageLayer.y}
                      width={imageLayer.width}
                      height={imageLayer.height}
                      fill="none"
                      stroke={imageLayer.borderColor}
                      strokeWidth={imageLayer.borderWidth}
                    />
                  )}
                  {isEditable && selectedLayerId === layer.id && handleResizeStart && (
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} />
                  )}
                </>
              );
            })() : null}
          </g>
        ))}
    </svg>
  );
};

export default CanvasPreview;
