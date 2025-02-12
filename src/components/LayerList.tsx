// src/components/LayerList.tsx
'use client';

import React, { useRef, DragEvent } from 'react';
import { Layer, TextLayer } from '../types/templateTypes';
import { Type, Image as ImageIcon, Copy, Trash } from 'lucide-react';
import styles from './LayerList.module.css';

interface LayerListProps {
  layers: Layer[];
  onSelectLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onDuplicate: (layer: Layer) => void;
  onDelete: (layer: Layer) => void;
  onDragStart: (e: DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent) => void;
  onDragLeave: () => void;
  dropIndicatorTop: number | null;
  activeLayerId: string | null;
}

const LayerList: React.FC<LayerListProps> = ({
  layers,
  onSelectLayer,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  dropIndicatorTop,
  activeLayerId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className="relative space-y-2"
    >
      {layers.map((layer: Layer, index: number) => (
        <div key={layer.id} className={`layer-item-wrapper ${layer.id === activeLayerId ? styles.active : ''}`}>
          <div
            className={`flex justify-between items-center w-full p-2 rounded transition-all duration-100 cursor-pointer hover:bg-gray-100 ${layer.id === activeLayerId ? styles.active : ''}`}
            onClick={() => onSelectLayer(layer.id)}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
          >
            <div className="flex items-center flex-1 overflow-hidden space-x-2">
              <span className="text-gray-400">⋮⋮</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(layer.id);
                }}
                className="p-1 rounded hover:bg-gray-200"
                title="Toggle Visibility"
              >
                {layer.visible ? '👁️' : '👁️‍🗨️'}
              </button>
              {layer.type === 'text' ? <Type size={16} /> : <ImageIcon size={16} />}
              <span className="truncate">
                {layer.name || (layer.type === 'text' ? (layer as TextLayer).text : '') || layer.id}
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(layer);
                }}
                className="flex items-center justify-center p-1 w-8 h-8 rounded hover:bg-gray-200"
                title="Duplicate Layer"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this layer?')) {
                    onDelete(layer);
                  }
                }}
                className="flex items-center justify-center p-1 w-8 h-8 rounded hover:bg-red-100"
                title="Delete Layer"
              >
                <Trash size={16} />
              </button>
            </div>
        </div>
        </div>
      ))}
      {dropIndicatorTop !== null && (
        <div
          className={styles.dropIndicator}
          style={{ '--drop-indicator-top': `${dropIndicatorTop}px` } as React.CSSProperties}
        />
      )}
    </div>
  );
};

export default LayerList;
