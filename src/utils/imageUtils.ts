// utils/imageUtils.ts
import { Layer, ImageLayer, TextLayer } from '../types/templateTypes';

// Helper function to safely cast a layer
const asImageLayer = (layer: Layer): ImageLayer => layer as ImageLayer;
const asTextLayer = (layer: Layer): TextLayer => layer as TextLayer;

export const resizeImage = (
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1200;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION;
            width = MAX_DIMENSION;
          } else {
            width = (width / height) * MAX_DIMENSION;
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: createPlaceholderImage(width, height), width, height });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve({ dataUrl, width, height });
        } catch (error) {
          console.error('Error generating data URL from canvas:', error);
          resolve({ dataUrl: createPlaceholderImage(width, height), width, height });
        }
      };
      img.onerror = () => {
        resolve({ 
          dataUrl: createPlaceholderImage(400, 300), 
          width: 400, 
          height: 300 
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Improved function to fetch external images as data URLs
export const fetchExternalImageAsDataURL = async (
  imageUrl: string
): Promise<string> => {
  // Check if it's already a data URL
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  try {
    // Try to use fetch with CORS mode
    try {
      const response = await fetch(imageUrl, { 
        mode: 'cors',
        credentials: 'omit', // Don't send cookies with the request
        headers: {
          'Origin': window.location.origin
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (fetchError) {
      console.warn('CORS fetch failed, trying Image approach:', fetchError);
      
      // Fallback to Image approach if fetch fails
      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          
          try {
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } catch (e) {
            console.error('Canvas tainted by cross-origin data, trying proxy fallback', e);
            
            // Try using a CORS proxy as a last resort
            const proxyImageUrl = `https://cors-anywhere.herokuapp.com/${imageUrl}`;
            const proxyImg = new Image();
            proxyImg.crossOrigin = 'anonymous';
            
            proxyImg.onload = () => {
              const proxyCanvas = document.createElement('canvas');
              proxyCanvas.width = proxyImg.width;
              proxyCanvas.height = proxyImg.height;
              
              const proxyCtx = proxyCanvas.getContext('2d');
              if (!proxyCtx) {
                reject(new Error('Failed to get proxy canvas context'));
                return;
              }
              
              proxyCtx.drawImage(proxyImg, 0, 0);
              
              try {
                const proxyDataUrl = proxyCanvas.toDataURL('image/png');
                resolve(proxyDataUrl);
              } catch {
                reject(new Error('Canvas tainted even with proxy'));
              }
            };
            
            proxyImg.onerror = () => {
              reject(new Error(`Failed to load image from proxy: ${proxyImageUrl}`));
            };
            
            proxyImg.src = proxyImageUrl;
          }
        };
        
        img.onerror = () => {
          reject(new Error(`Failed to load image from ${imageUrl}`));
        };
        
        // Try adding a cache-busting parameter to bypass caching issues
        const cacheBuster = `?cb=${Date.now()}`;
        // Ensure we don't add '?' if it already exists
        if (imageUrl.includes('?')) {
          img.src = imageUrl + '&' + cacheBuster.substring(1);
        } else {
          img.src = imageUrl + cacheBuster;
        }
      });
    }
  } catch (error) {
    console.error('Error fetching external image:', error);
    
    // Return a fallback placeholder
    // This prevents the app from crashing completely
    console.warn('Returning placeholder for failed image load:', imageUrl);
    return createPlaceholderImage(400, 300);
  }
};

// Helper function to create a placeholder image when loading fails
function createPlaceholderImage(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#d0d0d0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw text
    ctx.fillStyle = '#888888';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Image could not be loaded', width/2, height/2);
    ctx.font = '12px Arial';
    ctx.fillText('CORS or network error', width/2, height/2 + 20);
    
    // Draw border
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }
  
  return canvas.toDataURL('image/png');
}

// New function specifically for exporting SVG with images to PNG
export const exportSvgToPng = async (
  svgElement: SVGSVGElement,
  width: number,
  height: number,
  layersData?: Layer[] // Use proper type but understand it will be used dynamically
): Promise<string> => {
  try {
    // Create a canvas for the export
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // If we have direct layer data, use it to draw the elements directly
    if (layersData?.length) {
      // Directly render from the layer data (JSON)
      console.log('Using direct layer data for rendering:', layersData.length, 'layers');
      
      // Find the background image from the SVG element
      const backgroundImage = svgElement.querySelector('image[data-background="true"]');
      if (backgroundImage && backgroundImage.getAttribute('href') && 
          !backgroundImage.getAttribute('href')?.includes('[Background Image]')) {
        // Skip if it's a placeholder
        try {
          await drawImageToCanvas(ctx, backgroundImage.getAttribute('href') || '', 0, 0, width, height);
        } catch (error) {
          console.warn('Failed to draw background image, using solid color instead', error);
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, width, height);
        }
      }

      // Draw all image layers (bottom to top)
      const imageLayers = layersData.filter(l => l.type === 'image' && l.visible && l.id !== 'background_layer');
      for (const layer of imageLayers.reverse()) {
        const imgLayer = asImageLayer(layer);
        const cornerRadius = Math.min(imgLayer.cornerRadius || 0, Math.min(layer.width, layer.height) / 2);
        
        if (imgLayer.useColorFill && imgLayer.fillColor) {
          ctx.globalAlpha = layer.opacity ?? 1;
          ctx.fillStyle = imgLayer.fillColor;
          
          // Check if we need to apply an effect
          const effect = imgLayer.effect;
          
          // Save current context state
          ctx.save();
          
          // Draw a rounded rectangle path
          if (cornerRadius > 0) {
            // Helper function to draw a rounded rectangle path
            const drawRoundedRectPath = () => {
              ctx.beginPath();
              ctx.moveTo(layer.x + cornerRadius, layer.y);
              ctx.lineTo(layer.x + layer.width - cornerRadius, layer.y);
              ctx.arcTo(layer.x + layer.width, layer.y, layer.x + layer.width, layer.y + cornerRadius, cornerRadius);
              ctx.lineTo(layer.x + layer.width, layer.y + layer.height - cornerRadius);
              ctx.arcTo(layer.x + layer.width, layer.y + layer.height, layer.x + layer.width - cornerRadius, layer.y + layer.height, cornerRadius);
              ctx.lineTo(layer.x + cornerRadius, layer.y + layer.height);
              ctx.arcTo(layer.x, layer.y + layer.height, layer.x, layer.y + layer.height - cornerRadius, cornerRadius);
              ctx.lineTo(layer.x, layer.y + cornerRadius);
              ctx.arcTo(layer.x, layer.y, layer.x + cornerRadius, layer.y, cornerRadius);
              ctx.closePath();
            };

            // Draw the fill
            drawRoundedRectPath();
            ctx.fill();
            
            // Set up clipping region for patterns
            if (effect && effect !== 'none') {
              ctx.clip(); // Use the rounded rectangle as clip path
            }
          } else {
            // No corner radius, just draw a rectangle
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
            
            // Set up clipping region for patterns
            if (effect && effect !== 'none') {
              ctx.beginPath();
              ctx.rect(layer.x, layer.y, layer.width, layer.height);
              ctx.clip();
            }
          }
          
          // Apply patterns if needed
          if (effect && effect !== 'none') {
            // Apply the pattern effect on top with some transparency
            const patternSize = 20; // Size of the pattern tile
            
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ffffff';
            
            switch(effect) {
              case 'dots':
                // Draw dots
                const dotRadius = patternSize / 6;
                // Loop through the grid of potential dot positions
                for (let x = layer.x + patternSize/2; x < layer.x + layer.width; x += patternSize) {
                  for (let y = layer.y + patternSize/2; y < layer.y + layer.height; y += patternSize) {
                    // Ensure the dot (including its radius) stays within the layer boundaries
                    if (x - dotRadius >= layer.x && 
                        x + dotRadius <= layer.x + layer.width && 
                        y - dotRadius >= layer.y && 
                        y + dotRadius <= layer.y + layer.height) {
                      ctx.beginPath();
                      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                      ctx.fill();
                    }
                  }
                }
                break;
                
              case 'lines':
                // Draw diagonal lines that stay within boundaries
                ctx.beginPath();
                // Start from the top-left corner and go diagonally
                for (let i = 0; i < layer.width + layer.height; i += patternSize) {
                  // Start point - either on the top edge or left edge
                  const startX = i <= layer.height ? layer.x : layer.x + i - layer.height;
                  const startY = i <= layer.height ? layer.y + i : layer.y + layer.height;
                  
                  // End point - either on the right edge or bottom edge
                  const endX = i <= layer.width ? layer.x + i : layer.x + layer.width;
                  const endY = i <= layer.width ? layer.y : layer.y + i - layer.width;
                  
                  ctx.moveTo(startX, startY);
                  ctx.lineTo(endX, endY);
                }
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                break;
                
              case 'waves':
                // Draw wave pattern
                ctx.beginPath();
                // Draw horizontal waves
                const waveHeight = patternSize / 4;
                for (let y = layer.y; y < layer.y + layer.height; y += patternSize) {
                  for (let x = layer.x; x < layer.x + layer.width; x += patternSize) {
                    // Only draw complete waves within the boundaries
                    if (x + patternSize <= layer.x + layer.width) {
                      ctx.moveTo(x, y + patternSize/2);
                      ctx.quadraticCurveTo(
                        x + patternSize/4, y + patternSize/2 - waveHeight,
                        x + patternSize/2, y + patternSize/2
                      );
                      ctx.quadraticCurveTo(
                        x + 3*patternSize/4, y + patternSize/2 + waveHeight,
                        x + patternSize, y + patternSize/2
                      );
                    }
                  }
                }
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                break;
                
              case 'grid':
                // Draw grid
                ctx.beginPath();
                
                // Vertical lines
                for (let x = layer.x; x <= layer.x + layer.width; x += patternSize) {
                  // Only draw if we're inside or on the edge of the rectangle
                  if (x >= layer.x && x <= layer.x + layer.width) {
                    ctx.moveTo(x, layer.y);
                    ctx.lineTo(x, layer.y + layer.height);
                  }
                }
                
                // Horizontal lines
                for (let y = layer.y; y <= layer.y + layer.height; y += patternSize) {
                  // Only draw if we're inside or on the edge of the rectangle
                  if (y >= layer.y && y <= layer.y + layer.height) {
                    ctx.moveTo(layer.x, y);
                    ctx.lineTo(layer.x + layer.width, y);
                  }
                }
                
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                break;
                
              case 'checkerboard':
                // Draw checkerboard
                for (let x = layer.x; x < layer.x + layer.width; x += patternSize) {
                  for (let y = layer.y; y < layer.y + layer.height; y += patternSize) {
                    // Calculate how much space is available for this checkerboard cell
                    const availableWidth = Math.min(patternSize, layer.x + layer.width - x);
                    const availableHeight = Math.min(patternSize, layer.y + layer.height - y);
                    
                    // Skip if we don't have enough space for a visible checkerboard pattern
                    if (availableWidth < 1 || availableHeight < 1) continue;
                    
                    // Only draw checkerboard cells that fit within boundaries
                    if ((Math.floor((x - layer.x) / patternSize) + Math.floor((y - layer.y) / patternSize)) % 2 === 0) {
                      // Top-left square
                      ctx.fillRect(x, y, 
                                  Math.min(patternSize/2, availableWidth),
                                  Math.min(patternSize/2, availableHeight));
                      
                      // Bottom-right square (only if it fits)
                      if (x + patternSize/2 < layer.x + layer.width && y + patternSize/2 < layer.y + layer.height) {
                        ctx.fillRect(x + patternSize/2, y + patternSize/2, 
                                    Math.min(patternSize/2, layer.x + layer.width - (x + patternSize/2)),
                                    Math.min(patternSize/2, layer.y + layer.height - (y + patternSize/2)));
                      }
                    } else {
                      // Top-right square (only if it fits)
                      if (x + patternSize/2 < layer.x + layer.width) {
                        ctx.fillRect(x + patternSize/2, y, 
                                    Math.min(patternSize/2, layer.x + layer.width - (x + patternSize/2)),
                                    Math.min(patternSize/2, availableHeight));
                      }
                      
                      // Bottom-left square (only if it fits)
                      if (y + patternSize/2 < layer.y + layer.height) {
                        ctx.fillRect(x, y + patternSize/2, 
                                    Math.min(patternSize/2, availableWidth), 
                                    Math.min(patternSize/2, layer.y + layer.height - (y + patternSize/2)));
                      }
                    }
                  }
                }
                break;
            }
            
            // Restore context state after pattern
            ctx.restore();
          } else {
            // No effect, just restore the context
            ctx.restore();
          }
          
          // Draw border if needed (after restoring context)
          if (layer.borderWidth > 0) {
            ctx.globalAlpha = layer.opacity ?? 1;
            ctx.strokeStyle = layer.borderColor || '#000000';
            ctx.lineWidth = layer.borderWidth;
            
            if (cornerRadius > 0) {
              // Draw the same rounded rect path for the border
              ctx.beginPath();
              ctx.moveTo(layer.x + cornerRadius, layer.y);
              ctx.lineTo(layer.x + layer.width - cornerRadius, layer.y);
              ctx.arcTo(layer.x + layer.width, layer.y, layer.x + layer.width, layer.y + cornerRadius, cornerRadius);
              ctx.lineTo(layer.x + layer.width, layer.y + layer.height - cornerRadius);
              ctx.arcTo(layer.x + layer.width, layer.y + layer.height, layer.x + layer.width - cornerRadius, layer.y + layer.height, cornerRadius);
              ctx.lineTo(layer.x + cornerRadius, layer.y + layer.height);
              ctx.arcTo(layer.x, layer.y + layer.height, layer.x, layer.y + layer.height - cornerRadius, cornerRadius);
              ctx.lineTo(layer.x, layer.y + cornerRadius);
              ctx.arcTo(layer.x, layer.y, layer.x + cornerRadius, layer.y, cornerRadius);
              ctx.closePath();
              ctx.stroke();
            } else {
              ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
            }
            
            // Reset global alpha after drawing border
            ctx.globalAlpha = 1;
          }
        } else if (!imgLayer.useColorFill && imgLayer.src) {
          // For actual image sources
          try {
            // If we have a corner radius, we need to create a clipping path
            if (cornerRadius > 0) {
              ctx.save();
              
              // Create rounded rectangle clip path
              ctx.beginPath();
              ctx.moveTo(layer.x + cornerRadius, layer.y);
              ctx.lineTo(layer.x + layer.width - cornerRadius, layer.y);
              ctx.arcTo(layer.x + layer.width, layer.y, layer.x + layer.width, layer.y + cornerRadius, cornerRadius);
              ctx.lineTo(layer.x + layer.width, layer.y + layer.height - cornerRadius);
              ctx.arcTo(layer.x + layer.width, layer.y + layer.height, layer.x + layer.width - cornerRadius, layer.y + layer.height, cornerRadius);
              ctx.lineTo(layer.x + cornerRadius, layer.y + layer.height);
              ctx.arcTo(layer.x, layer.y + layer.height, layer.x, layer.y + layer.height - cornerRadius, cornerRadius);
              ctx.lineTo(layer.x, layer.y + cornerRadius);
              ctx.arcTo(layer.x, layer.y, layer.x + cornerRadius, layer.y, cornerRadius);
              ctx.closePath();
              ctx.clip();
            }
            
            // Draw the image
            ctx.globalAlpha = layer.opacity ?? 1;
            await drawImageToCanvas(ctx, imgLayer.src, layer.x, layer.y, layer.width, layer.height);
            
            // Restore context if we applied clipping
            if (cornerRadius > 0) {
              ctx.restore();
            }
            
            // Draw border if needed (and we'll need to redraw the rounded rect for the border)
            if (layer.borderWidth > 0) {
              ctx.globalAlpha = layer.opacity ?? 1;
              ctx.strokeStyle = layer.borderColor || '#000';
              ctx.lineWidth = layer.borderWidth;
              
              if (cornerRadius > 0) {
                ctx.beginPath();
                ctx.moveTo(layer.x + cornerRadius, layer.y);
                ctx.lineTo(layer.x + layer.width - cornerRadius, layer.y);
                ctx.arcTo(layer.x + layer.width, layer.y, layer.x + layer.width, layer.y + cornerRadius, cornerRadius);
                ctx.lineTo(layer.x + layer.width, layer.y + layer.height - cornerRadius);
                ctx.arcTo(layer.x + layer.width, layer.y + layer.height, layer.x + layer.width - cornerRadius, layer.y + layer.height, cornerRadius);
                ctx.lineTo(layer.x + cornerRadius, layer.y + layer.height);
                ctx.arcTo(layer.x, layer.y + layer.height, layer.x, layer.y + layer.height - cornerRadius, cornerRadius);
                ctx.lineTo(layer.x, layer.y + cornerRadius);
                ctx.arcTo(layer.x, layer.y, layer.x + cornerRadius, layer.y, cornerRadius);
                ctx.closePath();
                ctx.stroke();
              } else {
                ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
              }
              
            }
            
          } catch (error) {
            console.warn(`Failed to draw image for layer ${layer.id}:`, error);
            // Draw a placeholder rectangle if image fails to load
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          }
        }
      }
      
      // Draw all text layers (bottom to top)
      const textLayers = layersData.filter(l => l.type === 'text' && l.visible);
      for (const layer of textLayers.reverse()) {
        const txtLayer = asTextLayer(layer);
        // Set up text style
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.fillStyle = txtLayer.color || '#000000';
        ctx.font = `${txtLayer.italic ? 'italic' : 'normal'} ${txtLayer.bold ? 'bold' : 'normal'} ${txtLayer.size}px ${txtLayer.font || 'Arial'}`;
        ctx.textBaseline = 'top';
        
        // Draw background if needed
        if (txtLayer.useBackground) {
          ctx.fillStyle = txtLayer.backgroundColor || '#ffffff';
          const padding = txtLayer.bgPadding || 0;
          ctx.fillRect(
            layer.x - padding, 
            layer.y - padding, 
            layer.width + padding * 2, 
            layer.height + padding * 2
          );
          // Reset text color
          ctx.fillStyle = txtLayer.color || '#000000';
        }
        
        // Calculate position based on alignment
        let textX = layer.x;
        if (txtLayer.textAlign === 'center') {
          ctx.textAlign = 'center';
          textX = layer.x + layer.width / 2;
        } else if (txtLayer.textAlign === 'right') {
          ctx.textAlign = 'right';
          textX = layer.x + layer.width;
        } else {
          ctx.textAlign = 'left';
        }
        
        // Handle multi-line text
        const words = txtLayer.text.split(' ');
        let line = '';
        let lineY = layer.y;
        const lineHeight = txtLayer.size * 1.2; // Approximate line height
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > layer.width && i > 0) {
            // Draw current line and move to next line
            ctx.fillText(line, textX, lineY);
            line = words[i] + ' ';
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        }
        
        // Draw the last line (only if it fits within boundaries)
        if (lineY + lineHeight <= layer.y + layer.height) {
          ctx.fillText(line, textX, lineY);
        }
        
        // Draw border if set
        if (layer.borderWidth > 0) {
          ctx.strokeStyle = layer.borderColor || '#000000';
          ctx.lineWidth = layer.borderWidth;
          ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
        }
        
        ctx.globalAlpha = 1;
      }
      
      // Get PNG data URL
      return canvas.toDataURL('image/png');
    }
    
    // If no direct layer data is provided, use the SVG DOM approach as before
    // The rest of the existing SVG-based implementation
    // Draw the background if it exists
    const backgroundImage = svgElement.querySelector('image[data-background="true"]');
    if (backgroundImage && backgroundImage.getAttribute('href') && 
        !backgroundImage.getAttribute('href')?.includes('[Background Image]')) {
      // Skip if it's a placeholder
      try {
        await drawImageToCanvas(ctx, backgroundImage.getAttribute('href') || '', 0, 0, width, height);
      } catch (error) {
        console.warn('Failed to draw background image, using solid color instead', error);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, width, height);
      }
    }
    
    // Draw each layer manually
    const layers = Array.from(svgElement.querySelectorAll('g')).reverse();
    for (const layer of layers) {
      // Draw rectangles (shapes and backgrounds)
      const rects = layer.querySelectorAll('rect');
      rects.forEach(rect => {
        const x = parseFloat(rect.getAttribute('x') || '0');
        const y = parseFloat(rect.getAttribute('y') || '0');
        const rectWidth = parseFloat(rect.getAttribute('width') || '0');
        const rectHeight = parseFloat(rect.getAttribute('height') || '0');
        const fill = rect.getAttribute('fill');
        const opacity = parseFloat(rect.getAttribute('opacity') || '1');
        
        if (fill && fill !== 'none') {
          ctx.globalAlpha = opacity;
          ctx.fillStyle = fill;
          ctx.fillRect(x, y, rectWidth, rectHeight);
          ctx.globalAlpha = 1;
        }
        
        const stroke = rect.getAttribute('stroke');
        const strokeWidth = parseFloat(rect.getAttribute('stroke-width') || '0');
        if (stroke && strokeWidth > 0) {
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = stroke;
          ctx.lineWidth = strokeWidth;
          ctx.strokeRect(x, y, rectWidth, rectHeight);
          ctx.globalAlpha = 1;
        }
      });
      
      // Handle foreignObject text (TextLayer components)
      const foreignObjects = layer.querySelectorAll('foreignObject');
      foreignObjects.forEach(fo => {
        const x = parseFloat(fo.getAttribute('x') || '0');
        const y = parseFloat(fo.getAttribute('y') || '0');
        const foWidth = parseFloat(fo.getAttribute('width') || '0');
        
        // Get the parent layer element (g) to extract data attributes
        const parentG = fo.closest('g');
        
        // Find text content inside the foreignObject
        const divElement = fo.querySelector('div');
        if (divElement && divElement.textContent) {
          try {
            // Extract styling from the div
            const styles = window.getComputedStyle(divElement);
            
            // Try to get properties from data attributes first (more reliable) then fall back to computed styles
            // Use parentG to get attributes if available
            const getAttr = (name: string) => parentG?.getAttribute(name) || layer.getAttribute(name);
            
            const fontFamily = getAttr('data-font') || styles.fontFamily || 'Arial';
            const fontSizeAttr = getAttr('data-font-size');
            const fontSize = fontSizeAttr ? parseFloat(fontSizeAttr) : (parseFloat(styles.fontSize) || 16);
            const fontWeight = getAttr('data-bold') === 'true' ? 'bold' : (styles.fontWeight || 'normal');
            const fontStyle = getAttr('data-italic') === 'true' ? 'italic' : (styles.fontStyle || 'normal');
            const color = getAttr('data-color') || styles.color || '#000000';
            const textAlign = getAttr('data-text-align') || styles.textAlign || 'left';
            const opacity = getAttr('data-opacity') ? 
              parseFloat(getAttr('data-opacity') || '1') : 
              (parseFloat(styles.opacity || '1'));
            const textContent = divElement.textContent || '';
            
            // Apply styles and draw text
            ctx.globalAlpha = opacity;
            ctx.fillStyle = color;
            // Clean the font family string to avoid quotes that might cause issues
            const cleanFontFamily = fontFamily.replace(/["']/g, '').split(',')[0];
            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${cleanFontFamily}`;
            ctx.textBaseline = 'top';
            
            // Handle text alignment
            let textX = x;
            if (textAlign === 'center') {
              ctx.textAlign = 'center';
              textX = x + foWidth / 2;
            } else if (textAlign === 'right') {
              ctx.textAlign = 'right';
              textX = x + foWidth;
            } else {
              ctx.textAlign = 'left';
            }
            
            // Handle multi-line text with proper positioning
            const words = textContent.split(' ');
            let line = '';
            let lineY = y;
            const lineHeight = fontSize * 1.2; // Approximate line height
            
            for (let i = 0; i < words.length; i++) {
              const testLine = line + words[i] + ' ';
              const metrics = ctx.measureText(testLine);
              
              if (metrics.width > foWidth && i > 0) {
                // Draw current line and move to next line
                ctx.fillText(line, textX, lineY);
                line = words[i] + ' ';
                lineY += lineHeight;
              } else {
                line = testLine;
              }
            }
            
            // Draw the last line (only if it fits within boundaries)
            const foHeight = parseFloat(fo.getAttribute('height') || '0');
            if (lineY + lineHeight <= y + foHeight) {
              ctx.fillText(line, textX, lineY);
            }
            
            ctx.globalAlpha = 1;
          } catch (error) {
            console.warn('Error extracting text style:', error);
          }
        }
      });
      
      // Draw images
      const images = layer.querySelectorAll('image');
      for (const img of images) {
        const x = parseFloat(img.getAttribute('x') || '0');
        const y = parseFloat(img.getAttribute('y') || '0');
        const imgWidth = parseFloat(img.getAttribute('width') || '0');
        const imgHeight = parseFloat(img.getAttribute('height') || '0');
        const href = img.getAttribute('href');
        const opacity = parseFloat(img.getAttribute('opacity') || '1');
        
        // Get additional attributes like effect
        const parentG = img.closest('g');
        const effect = parentG?.getAttribute('data-effect') || 'none';
        const useFill = parentG?.getAttribute('data-color-fill') === 'true';
        const fillColor = parentG?.getAttribute('data-fill-color') || '#cccccc';
        const cornerRadius = parseFloat(parentG?.getAttribute('data-corner-radius') || '0');
        
        if (useFill) {
          // Draw color fill
          ctx.globalAlpha = opacity;
          ctx.fillStyle = fillColor;
          
          if (cornerRadius > 0) {
            // Create rounded rectangle
            ctx.save();
            // Helper function to create rounded rectangle clipping path
            const r = cornerRadius;
            
            // Create rounded rectangle path
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + imgWidth - r, y);
            ctx.arcTo(x + imgWidth, y, x + imgWidth, y + r, r);
            ctx.lineTo(x + imgWidth, y + imgHeight - r);
            ctx.arcTo(x + imgWidth, y + imgHeight, x + imgWidth - r, y + imgHeight, r);
            ctx.lineTo(x + r, y + imgHeight);
            ctx.arcTo(x, y + imgHeight, x, y + imgHeight - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillRect(x, y, imgWidth, imgHeight);
          }
          
          // Handle pattern effects
          if (effect && effect !== 'none') {
            // Draw patterns based on effect type
            const patternSize = 20;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            
            if (effect === 'dots') {
              // Draw dot pattern
              ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
              for (let dotX = x + 5; dotX < x + imgWidth; dotX += patternSize) {
                for (let dotY = y + 5; dotY < y + imgHeight; dotY += patternSize) {
                  ctx.beginPath();
                  ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
            // Additional patterns can be implemented here
          }
        } else if (href && !href.includes('[Image:') && imgWidth > 0 && imgHeight > 0) {
          try {
            ctx.globalAlpha = opacity;
            
            if (cornerRadius > 0) {
              ctx.save();
              // Create rounded rectangle clip path
              const r = cornerRadius;
              
              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + imgWidth - r, y);
              ctx.arcTo(x + imgWidth, y, x + imgWidth, y + r, r);
              ctx.lineTo(x + imgWidth, y + imgHeight - r);
              ctx.arcTo(x + imgWidth, y + imgHeight, x + imgWidth - r, y + imgHeight, r);
              ctx.lineTo(x + r, y + imgHeight);
              ctx.arcTo(x, y + imgHeight, x, y + imgHeight - r, r);
              ctx.lineTo(x, y + r);
              ctx.arcTo(x, y, x + r, y, r);
              ctx.closePath();
              ctx.clip();
              
              await drawImageToCanvas(ctx, href, x, y, imgWidth, imgHeight);
              ctx.restore();
            } else {
              await drawImageToCanvas(ctx, href, x, y, imgWidth, imgHeight);
            }
            
            ctx.globalAlpha = 1;
          } catch (error) {
            console.warn(`Failed to draw image at ${x},${y}`, error);
            // Draw placeholder for failed images
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(x, y, imgWidth, imgHeight);
          }
        } else if (imgWidth > 0 && imgHeight > 0) {
          // Draw a placeholder for missing images
          ctx.fillStyle = '#cccccc';
          ctx.fillRect(x, y, imgWidth, imgHeight);
        }
        
        // Draw border if specified
        const borderWidth = parseFloat(parentG?.getAttribute('data-border-width') || '0');
        const borderColor = parentG?.getAttribute('data-border-color') || '#000000';
        
        if (borderWidth > 0) {
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = borderWidth;
          
          if (cornerRadius > 0) {
            // Draw rounded rectangle border
            const r = cornerRadius;
            
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + imgWidth - r, y);
            ctx.arcTo(x + imgWidth, y, x + imgWidth, y + r, r);
            ctx.lineTo(x + imgWidth, y + imgHeight - r);
            ctx.arcTo(x + imgWidth, y + imgHeight, x + imgWidth - r, y + imgHeight, r);
            ctx.lineTo(x + r, y + imgHeight);
            ctx.arcTo(x, y + imgHeight, x, y + imgHeight - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, imgWidth, imgHeight);
          }
          
          ctx.globalAlpha = 1;
        }
      }
      
      // Draw text elements
      const texts = layer.querySelectorAll('text');
      texts.forEach(text => {
        const x = parseFloat(text.getAttribute('x') || '0');
        const y = parseFloat(text.getAttribute('y') || '0');
        const fill = text.getAttribute('fill') || '#000000';
        const fontSize = parseFloat(text.getAttribute('font-size') || '16');
        const fontFamily = text.getAttribute('font-family') || 'Arial';
        const fontWeight = text.getAttribute('font-weight') || 'normal';
        const fontStyle = text.getAttribute('font-style') || 'normal';
        const textAnchor = text.getAttribute('text-anchor') || 'start';
        const opacity = parseFloat(text.getAttribute('opacity') || '1');
        const textContent = text.textContent || '';
        
        ctx.globalAlpha = opacity;
        ctx.fillStyle = fill;
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
        ctx.textBaseline = 'top';
        
        // Handle text alignment
        let xPos = x;
        if (textAnchor === 'middle') {
          ctx.textAlign = 'center';
          xPos = x + parseFloat(text.getAttribute('width') || '0') / 2;
        } else if (textAnchor === 'end') {
          ctx.textAlign = 'right';
          xPos = x + parseFloat(text.getAttribute('width') || '0');
        } else {
          ctx.textAlign = 'left';
        }
        
        // Position text with baseline adjustment to match API rendering
        ctx.fillText(textContent, xPos, y);
        ctx.globalAlpha = 1;
      });
      
      // Try to find text content in nested spans (TextLayer might use them)
      const textSpans = layer.querySelectorAll('tspan');
      textSpans.forEach(span => {
        const x = parseFloat(span.getAttribute('x') || '0');
        const y = parseFloat(span.getAttribute('y') || '0');
        const fill = span.getAttribute('fill') || '#000000';
        const fontSize = parseFloat(span.getAttribute('font-size') || '16');
        const fontFamily = span.getAttribute('font-family') || 'Arial';
        const fontWeight = span.getAttribute('font-weight') || 'normal';
        const fontStyle = span.getAttribute('font-style') || 'normal';
        const textAnchor = span.getAttribute('text-anchor') || 'start';
        const opacity = parseFloat(span.getAttribute('opacity') || '1');
        const textContent = span.textContent || '';
        
        if (textContent.trim()) {
          ctx.globalAlpha = opacity;
          ctx.fillStyle = fill;
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
          ctx.textBaseline = 'top';
          
          // Handle text alignment
          const xPos = x;
          if (textAnchor === 'middle') {
            ctx.textAlign = 'center';
          } else if (textAnchor === 'end') {
            ctx.textAlign = 'right';
          } else {
            ctx.textAlign = 'left';
          }
          
          ctx.fillText(textContent, xPos, y);
          ctx.globalAlpha = 1;
        }
      });
    }
    
    // Get PNG data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error in exportSvgToPng:', error);
    throw error;
  }
};

// Helper function to draw an image to a canvas
const drawImageToCanvas = (
  ctx: CanvasRenderingContext2D,
  // src can be http URL or data URL
  src: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (!src || src === 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==') {
      // Skip empty or transparent placeholder
      resolve();
      return;
    }
    
    // Ensure we have a usable source (preferably data URL)
    // If it's already a data URL, use it directly.
    // If it's an HTTP URL, attempt conversion *again* during export just in case.
    let imageSrc = src;
    if (src.startsWith('http')) {
      try {
        // console.log('Attempting conversion for export:', src); // Verbose logging
        imageSrc = await fetchExternalImageAsDataURL(src);
      } catch (error) {
        console.error('Export: Failed to convert image URL to data URL, using original:', error);
        // Continue with the original URL and hope for the best (might taint canvas)
      }
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        ctx.drawImage(img, x, y, width, height);
        resolve();
      } catch (drawError) {
        // This can happen if the canvas is tainted (e.g., CORS issue despite conversion attempt)
        console.error(`Canvas drawing error for image ${src}:`, drawError);
        reject(drawError);
      }
    };
    
    img.onerror = (e) => {
      console.error(`Failed to load image into Image object: ${src}`, e);
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    // Add cache buster to URL if not a data URL
    if (imageSrc.startsWith('data:')) {
      img.src = imageSrc;
    } else {
       // Add cache buster only to non-data URLs
       const cacheBuster = `?cb=${Date.now()}`;
       img.src = `${imageSrc}${imageSrc.includes('?') ? '&' : cacheBuster.substring(1)}`;
    }
  });
}
