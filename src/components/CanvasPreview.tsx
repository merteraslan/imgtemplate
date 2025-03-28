// components/CanvasPreview.tsx
'use client';

import React from 'react';
import { Layer, BoundingBox, TextLayer as TextLayerType, ImageLayer, ShapeLayer } from '../types/templateTypes';
import TextLayer from './TextLayer';
import BoundingBoxComponent from './BoundingBox';

// Helper function to validate and sanitize dimension attributes
const sanitize = (value: number | undefined | null, defaultValue = 0): number => {
  return typeof value === 'number' && isFinite(value) ? value : defaultValue;
};

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
      {backgroundImage && (
        <image
          href={backgroundImage}
          x="0" y="0"
          width={canvasWidth}
          height={canvasHeight}
          preserveAspectRatio="xMidYMid slice"
          crossOrigin="anonymous"
          data-background="true"
        />
      )}

      {layers
        .slice()
        .reverse()
        .filter((l: Layer) => l.visible)
        .map((layer: Layer) => (
          <g key={layer.id}>
            {layer.type === 'text' && (() => {
              const textLayer = layer as TextLayerType;
              const bbox = textBBoxes[layer.id];

              // Sanitize bbox values if bbox exists
              const safeBBoxX = sanitize(bbox?.x);
              const safeBBoxY = sanitize(bbox?.y);
              const safeBBoxWidth = sanitize(bbox?.width, 0);
              const safeBBoxHeight = sanitize(bbox?.height, 0);

              return (
                <>
                  {textLayer.useBackground && bbox && safeBBoxWidth > 0 && safeBBoxHeight > 0 && (
                    <rect
                      x={safeBBoxX - sanitize(textLayer.bgPadding)}
                      y={safeBBoxY - sanitize(textLayer.bgPadding)}
                      width={safeBBoxWidth + 2 * sanitize(textLayer.bgPadding)}
                      height={safeBBoxHeight + 2 * sanitize(textLayer.bgPadding)}
                      fill={textLayer.backgroundColor}
                      opacity={sanitize(textLayer.opacity, 1)}
                    />
                  )}
                  <TextLayer
                    layer={textLayer}
                    onDragStart={isEditable && handleDragStart ? handleDragStart : () => { }}
                    updateBBox={updateTextBBox}
                    isEditable={isEditable}
                  />
                  {textLayer.borderWidth > 0 && bbox && safeBBoxWidth > 0 && safeBBoxHeight > 0 && (
                    <rect
                      x={safeBBoxX}
                      y={safeBBoxY}
                      width={safeBBoxWidth}
                      height={safeBBoxHeight}
                      fill="none"
                      stroke={textLayer.borderColor}
                      strokeWidth={sanitize(textLayer.borderWidth)}
                      opacity={sanitize(textLayer.opacity, 1)}
                    />
                  )}
                  {isEditable && selectedLayerId === layer.id && handleResizeStart && (
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} bbox={bbox} />
                  )}
                </>
              );
            })()}

            {layer.type === 'image' && (() => {
              const imageLayer = layer as ImageLayer;
              const imageMouseDownHandler = isEditable && handleDragStart ? (e: React.MouseEvent) => handleDragStart(e, layer) : undefined;

              // Sanitize image layer dimensions
              const safeX = sanitize(imageLayer.x);
              const safeY = sanitize(imageLayer.y);
              const safeWidth = sanitize(imageLayer.width, 0);
              const safeHeight = sanitize(imageLayer.height, 0);

              // Generate pattern definitions for different effects
              const generatePatternId = (layerId: string, effect: string) => `pattern-${layerId}-${effect}`;

              // Create pattern based on the effect type
              const renderPattern = () => {
                if (!imageLayer.effect || imageLayer.effect === 'none') {
                  return null;
                }

                const patternId = generatePatternId(imageLayer.id, imageLayer.effect);
                const patternSize = 20; // Size of the pattern tile

                switch (imageLayer.effect) {
                  case 'dots':
                    return (
                      <defs>
                        <pattern id={patternId} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
                          <rect width={patternSize} height={patternSize} fill={imageLayer.fillColor} />
                          <circle cx={patternSize / 2} cy={patternSize / 2} r={patternSize / 6} fill="#ffffff" fillOpacity="0.3" />
                        </pattern>
                      </defs>
                    );
                  case 'lines':
                    return (
                      <defs>
                        <pattern id={patternId} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
                          <rect width={patternSize} height={patternSize} fill={imageLayer.fillColor} />
                          <line x1="0" y1="0" x2={patternSize} y2={patternSize} strokeWidth="2" stroke="#ffffff" strokeOpacity="0.3" />
                        </pattern>
                      </defs>
                    );
                  case 'waves':
                    return (
                      <defs>
                        <pattern id={patternId} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
                          <rect width={patternSize} height={patternSize} fill={imageLayer.fillColor} />
                          <path d={`M0,${patternSize / 2} Q${patternSize / 4},${patternSize / 4} ${patternSize / 2},${patternSize / 2} T${patternSize},${patternSize / 2}`}
                            fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" />
                        </pattern>
                      </defs>
                    );
                  case 'grid':
                    return (
                      <defs>
                        <pattern id={patternId} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
                          <rect width={patternSize} height={patternSize} fill={imageLayer.fillColor} />
                          <line x1="0" y1="0" x2="0" y2={patternSize} strokeWidth="1" stroke="#ffffff" strokeOpacity="0.3" />
                          <line x1="0" y1="0" x2={patternSize} y2="0" strokeWidth="1" stroke="#ffffff" strokeOpacity="0.3" />
                        </pattern>
                      </defs>
                    );
                  case 'checkerboard':
                    return (
                      <defs>
                        <pattern id={patternId} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
                          <rect width={patternSize} height={patternSize} fill={imageLayer.fillColor} />
                          <rect width={patternSize / 2} height={patternSize / 2} fill="#ffffff" fillOpacity="0.2" />
                          <rect x={patternSize / 2} y={patternSize / 2} width={patternSize / 2} height={patternSize / 2} fill="#ffffff" fillOpacity="0.2" />
                        </pattern>
                      </defs>
                    );
                  default:
                    return null;
                }
              };

              return (
                <>
                  {renderPattern()}
                  {imageLayer.useColorFill ? (
                    <rect
                      x={safeX}
                      y={safeY}
                      width={safeWidth}
                      height={safeHeight}
                      rx={sanitize(imageLayer.cornerRadius)}
                      ry={sanitize(imageLayer.cornerRadius)}
                      fill={imageLayer.effect && imageLayer.effect !== 'none'
                        ? `url(#${generatePatternId(imageLayer.id, imageLayer.effect)})`
                        : imageLayer.fillColor}
                      opacity={sanitize(imageLayer.opacity, 1)}
                      style={{ cursor: isEditable ? 'move' : 'default' }}
                      onMouseDown={imageMouseDownHandler}
                    />
                  ) : (
                    imageLayer.src && safeWidth > 0 && safeHeight > 0 && (
                      <>
                        {imageLayer.cornerRadius > 0 && (
                          <defs>
                            <clipPath id={`image-clip-${imageLayer.id}`}>
                              <rect
                                x={safeX}
                                y={safeY}
                                width={safeWidth}
                                height={safeHeight}
                                rx={sanitize(imageLayer.cornerRadius)}
                                ry={sanitize(imageLayer.cornerRadius)}
                              />
                            </clipPath>
                          </defs>
                        )}
                        <image
                          href={imageLayer.src}
                          x={safeX}
                          y={safeY}
                          width={safeWidth}
                          height={safeHeight}
                          preserveAspectRatio="none"
                          opacity={sanitize(imageLayer.opacity, 1)}
                          style={{ cursor: isEditable ? 'move' : 'default' }}
                          onMouseDown={imageMouseDownHandler}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                          crossOrigin="anonymous"
                          clipPath={imageLayer.cornerRadius > 0 ? `url(#image-clip-${imageLayer.id})` : undefined}
                        />
                      </>
                    )
                  )}
                  {imageLayer.borderWidth > 0 && safeWidth > 0 && safeHeight > 0 && (
                    <rect
                      x={safeX}
                      y={safeY}
                      width={safeWidth}
                      height={safeHeight}
                      rx={sanitize(imageLayer.cornerRadius)}
                      ry={sanitize(imageLayer.cornerRadius)}
                      fill="none"
                      stroke={imageLayer.borderColor}
                      strokeWidth={sanitize(imageLayer.borderWidth)}
                      opacity={sanitize(imageLayer.opacity, 1)}
                    />
                  )}
                  {isEditable && selectedLayerId === layer.id && handleResizeStart && (
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} />
                  )}
                </>
              );
            })()}

            {layer.type === 'shape' && (() => {
              const shapeLayer = layer as ShapeLayer;
              const shapeMouseDownHandler = isEditable && handleDragStart ? (e: React.MouseEvent) => handleDragStart(e, layer) : undefined;

              // Sanitize shape layer dimensions
              const safeX = sanitize(shapeLayer.x);
              const safeY = sanitize(shapeLayer.y);
              const safeWidth = sanitize(shapeLayer.width, 0);
              const safeHeight = sanitize(shapeLayer.height, 0);

              return (
                <>
                  {safeWidth > 0 && safeHeight > 0 && (
                    <rect
                      x={safeX}
                      y={safeY}
                      width={safeWidth}
                      height={safeHeight}
                      fill={shapeLayer.fillColor}
                      stroke={shapeLayer.strokeColor}
                      strokeWidth={sanitize(shapeLayer.strokeWidth)}
                      opacity={sanitize(shapeLayer.opacity, 1)}
                      style={{ cursor: isEditable ? 'move' : 'default' }}
                      onMouseDown={shapeMouseDownHandler}
                    />
                  )}
                  {isEditable && selectedLayerId === layer.id && handleResizeStart && (
                    <BoundingBoxComponent layer={layer} onResizeStart={handleResizeStart} />
                  )}
                </>
              );
            })()}
          </g>
        ))}
    </svg>
  );
};

export default CanvasPreview;
