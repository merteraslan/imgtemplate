// src/components/LayerProperties.tsx
'use client';

import React from 'react';
import { Layer, TextLayer, ImageLayer } from '../types/templateTypes';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Lock,
  Unlock,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd
} from 'lucide-react';

interface LayerPropertiesProps {
  selectedLayer: Layer;
  layerNameInput: string;
  onLayerNameChange: (value: string) => void;
  onLayerNameBlur: () => void;
  // For text layers:
  onTextChange?: (value: string) => void;
  onFontChange?: (value: string) => void;
  onFontSizeChange?: (value: number) => void;
  onColorChange?: (value: string) => void;
  onToggleBold?: () => void;
  onToggleItalic?: () => void;
  onTextAlignChange?: (value: 'left' | 'center' | 'right') => void;
  onToggleBackground?: (checked: boolean) => void;
  onBackgroundColorChange?: (value: string) => void;
  onBackgroundPaddingChange?: (value: number) => void;
  // Removed unused border props
  // Dimensions:
  layerWidthInput: string;
  layerHeightInput: string;
  onLayerWidthChange: (value: string) => void;
  onLayerHeightChange: (value: string) => void;
  onLayerWidthBlur: () => void;
  onLayerHeightBlur: () => void;
  // Position:
  layerXInput: string;
  layerYInput: string;
  onLayerXChange: (value: string) => void;
  onLayerYChange: (value: string) => void;
  onLayerXBlur: () => void;
  onLayerYBlur: () => void;
  // For image layers:
  onImageUrlChange?: (value: string) => void;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleColorFill?: (checked: boolean) => void;
  onFillColorChange?: (value: string) => void;
  onEffectChange?: (value: 'none' | 'dots' | 'lines' | 'waves' | 'grid' | 'checkerboard' | null) => void;
  onCornerRadiusChange?: (value: number) => void;
  onBorderWidthChange?: (value: number) => void;
  onBorderColorChange?: (value: string) => void;
  // Alignment settings:
  onAlignHorizontally?: (direction: 'left' | 'center' | 'right') => void;
  onAlignVertically?: (direction: 'top' | 'middle' | 'bottom') => void;
  alignTargetLayerId: string;
  onAlignTargetChange?: (value: string) => void;
  // Opacity control
  onOpacityChange?: (value: number) => void;
  // A list of layers available for alignment
  layersForAlignment?: Layer[];
  onToggleAspectRatio?: () => void;
}

const LayerProperties: React.FC<LayerPropertiesProps> = ({
  selectedLayer,
  layerNameInput,
  onLayerNameChange,
  onLayerNameBlur,
  onTextChange,
  onFontChange,
  onFontSizeChange,
  onColorChange,
  onToggleBold,
  onToggleItalic,
  onTextAlignChange,
  onToggleBackground,
  onBackgroundColorChange,
  onBackgroundPaddingChange,
  layerWidthInput,
  layerHeightInput,
  onLayerWidthChange,
  onLayerHeightChange,
  onLayerWidthBlur,
  onLayerHeightBlur,
  layerXInput,
  layerYInput,
  onLayerXChange,
  onLayerYChange,
  onLayerXBlur,
  onLayerYBlur,
  onImageUrlChange,
  onFileChange,
  onToggleColorFill,
  onFillColorChange,
  onEffectChange,
  onCornerRadiusChange,
  onBorderWidthChange,
  onBorderColorChange,
  onAlignHorizontally,
  onAlignVertically,
  alignTargetLayerId,
  onAlignTargetChange,
  onOpacityChange,
  layersForAlignment,
  onToggleAspectRatio
}) => {
  // Cast to the appropriate type for text or image layers.
  const textLayer = selectedLayer.type === 'text' ? (selectedLayer as TextLayer) : null;
  const imageLayer = selectedLayer.type === 'image' ? (selectedLayer as ImageLayer) : null;

  return (
    <div>
      <h3 className="text-lg font-bold">Layer Properties</h3>
      <div className="mb-2">
        <label className="block text-sm font-medium">Layer Name</label>
        <input
          type="text"
          value={layerNameInput}
          onChange={(e) => onLayerNameChange(e.target.value)}
          onBlur={onLayerNameBlur}
          aria-label="Layer name"
          className="mt-1 block w-full border-gray-300 rounded-md"
        />
      </div>
      {selectedLayer.type === 'text' && textLayer && (
        <>
          <div className="mb-2">
            <label className="block text-sm font-medium">Text</label>
            <input
              type="text"
              value={textLayer.text}
              onChange={(e) => onTextChange && onTextChange(e.target.value)}
              aria-label="Layer text content"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Font</label>
            <select
              value={textLayer.font}
              onChange={(e) => onFontChange && onFontChange(e.target.value)}
              aria-label="Layer font"
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
              value={textLayer.size}
              onChange={(e) => onFontSizeChange && onFontSizeChange(parseInt(e.target.value, 10))}
              aria-label="Layer font size"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Color</label>
            <input
              type="color"
              value={textLayer.color}
              onChange={(e) => onColorChange && onColorChange(e.target.value)}
              aria-label="Layer color"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Text Styling</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={onToggleBold}
                className={`px-2 py-1 border rounded ${textLayer.bold ? 'bg-blue-500 text-white' : 'bg-white'}`}
                title="Toggle Bold"
              >
                B
              </button>
              <button
                onClick={onToggleItalic}
                className={`px-2 py-1 border rounded ${textLayer.italic ? 'bg-blue-500 text-white' : 'bg-white'}`}
                title="Toggle Italic"
              >
                <span style={{ fontStyle: 'italic' }}>I</span>
              </button>
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Text Alignment</label>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => onTextAlignChange && onTextAlignChange('left')}
                className={`p-1 border rounded hover:bg-gray-100 ${(textLayer.textAlign === 'left' || !textLayer.textAlign) ? 'bg-blue-100' : 'bg-white'
                  }`}
                title="Align Text Left"
              >
                <AlignHorizontalJustifyStart size={16} />
              </button>
              <button
                onClick={() => onTextAlignChange && onTextAlignChange('center')}
                className={`p-1 border rounded hover:bg-gray-100 ${textLayer.textAlign === 'center' ? 'bg-blue-100' : 'bg-white'
                  }`}
                title="Align Text Center"
              >
                <AlignHorizontalJustifyCenter size={16} />
              </button>
              <button
                onClick={() => onTextAlignChange && onTextAlignChange('right')}
                className={`p-1 border rounded hover:bg-gray-100 ${textLayer.textAlign === 'right' ? 'bg-blue-100' : 'bg-white'
                  }`}
                title="Align Text Right"
              >
                <AlignHorizontalJustifyEnd size={16} />
              </button>
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Background Options</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                aria-label="Enable background for text layer"
                title="Toggle background for text layer"
                checked={textLayer.useBackground}
                onChange={(e) => onToggleBackground && onToggleBackground(e.target.checked)}
              />
              <span className="text-sm">Enable Background</span>
            </div>
            {textLayer.useBackground && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500">Background Color</label>
                <input
                  type="color"
                  value={textLayer.backgroundColor}
                  onChange={(e) => onBackgroundColorChange && onBackgroundColorChange(e.target.value)}
                  aria-label="Layer background color"
                  className="mt-1 block w-full border-gray-300 rounded-md"
                />
                <label className="block text-xs text-gray-500 mt-2">Padding</label>
                <input
                  type="number"
                  value={textLayer.bgPadding}
                  onChange={(e) =>
                    onBackgroundPaddingChange && onBackgroundPaddingChange(parseInt(e.target.value, 10))
                  }
                  aria-label="Layer background padding"
                  className="mt-1 block w-full border-gray-300 rounded-md"
                />
              </div>
            )}
          </div>
        </>
      )}
      {selectedLayer.type === 'image' && imageLayer && (
        <>
          <div className="mb-2">
            <label className="block text-sm font-medium">Image URL</label>
            <input
              type="url"
              value={imageLayer.src || ''}
              onChange={(e) => onImageUrlChange && onImageUrlChange(e.target.value)}
              aria-label="Layer image URL"
              className="mt-1 block w-full border-gray-300 rounded-md"
              placeholder="https://example.com/image.jpg"
            />
            {imageLayer._isLoading && <p className="text-xs text-blue-500 mt-1">Loading image...</p>}
            {imageLayer._error && <p className="text-xs text-red-500 mt-1">Error: {imageLayer._error}</p>}
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Image Source</label>
            <input
              type="file"
              accept="image/*"
              aria-label="Upload layer image"
              title="Choose an image for the layer"
              onChange={onFileChange}
              className="mt-1 block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Fill Options</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                aria-label="Enable color fill for image layer"
                title="Toggle color fill for image layer"
                checked={imageLayer.useColorFill}
                onChange={(e) => onToggleColorFill && onToggleColorFill(e.target.checked)}
              />
              <span className="text-sm">Use Color Fill</span>
            </div>
            {imageLayer.useColorFill && (
              <>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500">Fill Color</label>
                  <input
                    type="color"
                    value={imageLayer.fillColor}
                    onChange={(e) => onFillColorChange && onFillColorChange(e.target.value)}
                    aria-label="Layer fill color"
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  />
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-500">Pattern Effect</label>
                  <select
                    value={imageLayer.effect || 'none'}
                    onChange={(e) => onEffectChange && onEffectChange(e.target.value as 'none' | 'dots' | 'lines' | 'waves' | 'grid' | 'checkerboard' | null)}
                    aria-label="Layer pattern effect"
                    className="mt-1 block w-full border-gray-300 rounded-md"
                  >
                    <option value="none">None</option>
                    <option value="dots">Dots</option>
                    <option value="lines">Lines</option>
                    <option value="waves">Waves</option>
                    <option value="grid">Grid</option>
                    <option value="checkerboard">Checkerboard</option>
                  </select>
                </div>
              </>
            )}
            <div className="mt-2">
              <label className="block text-xs text-gray-500">Corner Radius</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={imageLayer.cornerRadius}
                onChange={(e) => onCornerRadiusChange && onCornerRadiusChange(parseInt(e.target.value))}
                aria-label="Corner radius"
                className="mt-1 block w-full"
              />
              <span className="text-xs text-gray-500">{imageLayer.cornerRadius}px</span>
            </div>
            <div className="mt-2">
              <label className="block text-xs text-gray-500">Border Width</label>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={imageLayer.borderWidth}
                onChange={(e) => onBorderWidthChange && onBorderWidthChange(parseInt(e.target.value))}
                aria-label="Border width"
                className="mt-1 block w-full"
              />
              <span className="text-xs text-gray-500">{imageLayer.borderWidth}px</span>
            </div>
            {imageLayer.borderWidth > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500">Border Color</label>
                <input
                  type="color"
                  value={imageLayer.borderColor}
                  onChange={(e) => onBorderColorChange && onBorderColorChange(e.target.value)}
                  aria-label="Border color"
                  className="mt-1 block w-full border-gray-300 rounded-md"
                />
              </div>
            )}
          </div>
        </>
      )}
      <div className="mb-2">
        <label className="block text-sm font-medium">Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={selectedLayer.opacity ?? 1}
          onChange={(e) => onOpacityChange && onOpacityChange(parseFloat(e.target.value))}
          aria-label="Layer opacity"
          className="mt-1 block w-full"
        />
        <span className="text-xs text-gray-500">{(selectedLayer.opacity ?? 1).toFixed(2)}</span>
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium">Dimensions</label>
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-xs text-gray-500">Width</label>
            <input
              type="number"
              value={layerWidthInput}
              onChange={(e) => onLayerWidthChange(e.target.value)}
              onBlur={onLayerWidthBlur}
              aria-label="Layer width"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div className="pt-5">×</div>
          <div>
            <label className="block text-xs text-gray-500">Height</label>
            <input
              type="number"
              value={layerHeightInput}
              onChange={(e) => onLayerHeightChange(e.target.value)}
              onBlur={onLayerHeightBlur}
              aria-label="Layer height"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Aspect Ratio: {(selectedLayer.width / selectedLayer.height).toFixed(2)}
          </span>
          <button
            onClick={onToggleAspectRatio}
            className="p-1 border rounded hover:bg-gray-100"
            title={selectedLayer.lockAspectRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
          >
            {selectedLayer.lockAspectRatio ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
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
              onChange={(e) => onLayerXChange(e.target.value)}
              onBlur={onLayerXBlur}
              aria-label="Layer X position"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={layerYInput}
              onChange={(e) => onLayerYChange(e.target.value)}
              onBlur={onLayerYBlur}
              aria-label="Layer Y position"
              className="mt-1 block w-full border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
      {/* Alignment Settings */}
      {onAlignHorizontally && onAlignVertically && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium">Align With</label>
            <select
              aria-label="Select parent layer"
              value={alignTargetLayerId}
              onChange={(e) => onAlignTargetChange && onAlignTargetChange(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md"
            >
              <option value="">Canvas</option>
              {layersForAlignment &&
                layersForAlignment
                  .filter((l) => l.id !== selectedLayer.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || (l.type === 'text' ? (l as TextLayer).text : '') || l.id}
                    </option>
                  ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Horizontal Alignment</label>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => onAlignHorizontally && onAlignHorizontally('left')}
                className="px-2 py-1 border rounded hover:bg-gray-100"
                title="Align Left"
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => onAlignHorizontally && onAlignHorizontally('center')}
                className="px-2 py-1 border rounded hover:bg-gray-100"
                title="Align Center"
              >
                <AlignCenter size={16} />
              </button>
              <button
                onClick={() => onAlignHorizontally && onAlignHorizontally('right')}
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
                onClick={() => onAlignVertically && onAlignVertically('top')}
                className="px-2 py-1 border rounded hover:bg-gray-100"
                title="Align Top"
              >
                <AlignStartVertical size={16} />
              </button>
              <button
                onClick={() => onAlignVertically && onAlignVertically('middle')}
                className="px-2 py-1 border rounded hover:bg-gray-100"
                title="Align Middle"
              >
                <AlignCenterVertical size={16} />
              </button>
              <button
                onClick={() => onAlignVertically && onAlignVertically('bottom')}
                className="px-2 py-1 border rounded hover:bg-gray-100"
                title="Align Bottom"
              >
                <AlignEndVertical size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LayerProperties;
