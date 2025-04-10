// types/templateTypes.ts
export type LayerType = 'text' | 'image' | 'shape';

export interface BaseLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  borderWidth: number;
  borderColor: string;
  lockAspectRatio: boolean;
  opacity: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  font: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  textAlign?: 'left' | 'center' | 'right';
  useBackground: boolean;
  backgroundColor: string;
  bgPadding: number;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  useColorFill: boolean;
  fillColor: string;
  effect: 'none' | 'dots' | 'lines' | 'waves' | 'grid' | 'checkerboard' | null;
  cornerRadius: number;
  _isLoading?: boolean; // Optional internal state for UI feedback
  _error?: string | null; // Optional internal state for UI feedback
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  fillColor: string;
  strokeWidth: number;
  strokeColor: string;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateData {
  layers?: Layer[];
  canvasWidth?: number;
  canvasHeight?: number;
  backgroundImage?: string | null;
}
