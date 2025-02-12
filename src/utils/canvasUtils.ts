// utils/canvasUtils.ts
import { Layer, LayerType } from '../types/templateTypes';

export const canvasPresets = [
  { label: 'Custom', value: '' },
  { label: 'Instagram Post (1080 x 1080)', value: '1080x1080' },
  { label: 'Instagram Story (1080 x 1920)', value: '1080x1920' },
  { label: 'Twitter Post (1200 x 675)', value: '1200x675' },
  { label: 'Facebook Post (1200 x 630)', value: '1200x630' }
];

export const getUniqueLayerName = (prevLayers: Layer[], type: LayerType): string => {
  const basePrefix = type.charAt(0).toUpperCase() + type.slice(1);
  let counter = 1;
  let name = `${basePrefix} ${counter}`;
  while (prevLayers.some((l) => l.name === name)) {
    counter++;
    name = `${basePrefix} ${counter}`;
  }
  return name;
};
