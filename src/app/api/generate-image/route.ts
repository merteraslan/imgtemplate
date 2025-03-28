import { NextRequest, NextResponse } from 'next/server';
import { TemplateData } from '@/types/templateTypes';
import puppeteer from 'puppeteer';

// Function that draws the image directly in Node.js using canvas
async function renderImageFromJSON(templateData: TemplateData): Promise<Buffer> {
  let browser;
  try {
    console.log('Attempting to launch browser with puppeteer...');
    // Initialize browser for headless rendering
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--disable-web-security',  // Disable CORS for testing
        '--allow-file-access-from-files',
        '--allow-file-access',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Create a simple HTML page with a canvas
    const html = `
      <html>
        <head>
          <style>
            body, html { 
              margin: 0; 
              padding: 0; 
              overflow: hidden;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
              font-smooth: always;
            }
            #container { 
              width: ${templateData.canvasWidth ?? 1080}px; 
              height: ${templateData.canvasHeight ?? 1080}px; 
            }
            canvas { 
              display: block; 
            }
            
            /* Preload common fonts to ensure they render consistently */
            @font-face {
              font-family: 'Arial';
              src: local('Arial');
              font-display: block;
            }
            
            @font-face {
              font-family: 'Helvetica';
              src: local('Helvetica');
              font-display: block;
            }
            
            @font-face {
              font-family: 'Times New Roman';
              src: local('Times New Roman');
              font-display: block;
            }
          </style>
          <!-- Preload common web fonts -->
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&display=swap" rel="stylesheet">
        </head>
        <body>
          <div id="container">
            <canvas id="renderCanvas" width="${templateData.canvasWidth ?? 1080}" height="${templateData.canvasHeight ?? 1080}"></canvas>
          </div>
          <!-- Hidden elements to ensure fonts are loaded before rendering -->
          <div style="position: absolute; visibility: hidden; font-family: Arial; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: Helvetica; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: 'Times New Roman'; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: 'Roboto'; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: 'Open Sans'; font-size: 0;">.</div>
        </body>
      </html>
    `;

    // Set the content and wait for it to load
    await page.setContent(html);

    // Wait for fonts to load to ensure correct text rendering
    await page.evaluate(() => {
      return document.fonts.ready.then(() => {
        console.log('All fonts are loaded and ready');
      });
    });

    // Define the rendering script directly instead of importing
    const renderingScript = `
      // Helper function to convert external URLs to data URLs
      async function loadImageAsDataURL(imageUrl) {
        // If already a data URL, return as is
        if (imageUrl.startsWith('data:')) {
          return imageUrl;
        }

        try {
          // Create a proxy URL to bypass CORS issues
          const proxyUrl = imageUrl.startsWith('http') 
            ? \`https://api.allorigins.win/raw?url=\${encodeURIComponent(imageUrl)}\`
            : imageUrl;
          
          const response = await fetch(proxyUrl, { 
            mode: 'cors',
            headers: {
              'Origin': 'null'
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to load image');
          }
          
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn('Error loading image:', error);
          // Return a blank transparent data URL
          return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }
      }

      async function renderTemplate(data) {
        const canvas = document.getElementById('renderCanvas');
        const ctx = canvas.getContext('2d', {
          alpha: true,
          antialias: true,
          desynchronized: false
        });
        
        if (!ctx) throw new Error('Failed to get canvas context');
        
        // Set consistent text rendering params
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.textRendering = 'geometricPrecision';
        
        // Helper function to create rounded rectangle clipping path
        function applyCornerRadius(ctx, layer) {
          const r = layer.cornerRadius;
          
          // Calculate pixel-perfect coordinates to match border drawing
          const x = Math.floor(layer.x);
          const y = Math.floor(layer.y);
          const width = Math.floor(layer.width);
          const height = Math.floor(layer.height);
          
          // Create rounded rectangle clip path
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.arcTo(x + width, y, x + width, y + r, r);
          ctx.lineTo(x + width, y + height - r);
          ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
          ctx.lineTo(x + r, y + height);
          ctx.arcTo(x, y + height, x, y + height - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
          ctx.clip();
        }
        
        // Initialize debug mode based on query parameter (if present)
        const debugMode = data.debug === true;
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Process background image if exists
        if (data.backgroundImage) {
          try {
            const dataUrl = await loadImageAsDataURL(data.backgroundImage);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = dataUrl;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } catch {
            console.warn('Failed to draw background image');
          }
        }
        
        // Ensure layers are processed in the exact same order as frontend
        // The frontend renders layers in REVERSE order (.slice().reverse())
        let layersToRender = [];
        if (data.layers && Array.isArray(data.layers)) {
          // First make a copy of the layers array
          layersToRender = [...data.layers];
          
          // Then REVERSE the order to match the frontend's rendering behavior
          // Frontend code: layers.slice().reverse().filter((l: Layer) => l.visible)
          layersToRender = layersToRender.reverse().filter(layer => layer.visible);
        }
        
        // Draw layers in the reversed order (matching frontend)
        for (const layer of layersToRender) {
          // No need to check visibility again since we filtered above
          
          // Apply layer opacity
          ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
          
          // Handle different layer types
          switch(layer.type) {
            case 'image':
              if (layer.useColorFill) {
                // Draw colored rectangle
                ctx.fillStyle = layer.fillColor || '#cccccc';
                
                // Handle pattern effects for filled images
                if (layer.effect && layer.effect !== 'none') {
                  // Create patterns based on the effect type
                  const patternSize = 20; // Size of the pattern tile
                  
                  // Create a temporary canvas for the pattern
                  const patternCanvas = document.createElement('canvas');
                  patternCanvas.width = patternSize;
                  patternCanvas.height = patternSize;
                  const patternCtx = patternCanvas.getContext('2d');
                  
                  if (patternCtx) {
                    // Fill the pattern background
                    patternCtx.fillStyle = layer.fillColor || '#cccccc';
                    patternCtx.fillRect(0, 0, patternSize, patternSize);
                    
                    // Draw the pattern based on effect type
                    patternCtx.strokeStyle = '#ffffff';
                    patternCtx.fillStyle = '#ffffff';
                    patternCtx.globalAlpha = 0.3; // Match the 0.3 opacity from frontend
                    
                    switch(layer.effect) {
                      case 'dots':
                        // Draw a circle in the center
                        patternCtx.beginPath();
                        patternCtx.arc(patternSize/2, patternSize/2, patternSize/6, 0, Math.PI * 2);
                        patternCtx.fill();
                        break;
                        
                      case 'lines':
                        // Draw diagonal lines
                        patternCtx.lineWidth = 2;
                        patternCtx.beginPath();
                        patternCtx.moveTo(0, 0);
                        patternCtx.lineTo(patternSize, patternSize);
                        patternCtx.stroke();
                        break;
                        
                      case 'waves':
                        // Draw wave pattern
                        patternCtx.lineWidth = 2;
                        patternCtx.beginPath();
                        patternCtx.moveTo(0, patternSize/2);
                        patternCtx.quadraticCurveTo(
                          patternSize/4, patternSize/4,
                          patternSize/2, patternSize/2
                        );
                        patternCtx.quadraticCurveTo(
                          3*patternSize/4, 3*patternSize/4,
                          patternSize, patternSize/2
                        );
                        patternCtx.stroke();
                        break;
                        
                      case 'grid':
                        // Draw grid lines
                        patternCtx.lineWidth = 1;
                        patternCtx.beginPath();
                        patternCtx.moveTo(0, 0);
                        patternCtx.lineTo(0, patternSize);
                        patternCtx.moveTo(0, 0);
                        patternCtx.lineTo(patternSize, 0);
                        patternCtx.stroke();
                        break;
                        
                      case 'checkerboard':
                        // Draw checkerboard pattern
                        patternCtx.globalAlpha = 0.2; // Match frontend opacity
                        patternCtx.fillRect(0, 0, patternSize/2, patternSize/2);
                        patternCtx.fillRect(patternSize/2, patternSize/2, patternSize/2, patternSize/2);
                        break;
                    }
                    
                    // Create pattern from the pattern canvas
                    const pattern = ctx.createPattern(patternCanvas, 'repeat');
                    if (pattern) {
                      ctx.fillStyle = pattern;
                    }
                  }
                }
                
                // Draw rectangle with the pattern or solid fill
                if (layer.cornerRadius > 0) {
                  // Draw rounded rectangle
                  const r = layer.cornerRadius;
                  
                  // Use pixel-perfect coordinates
                  const x = Math.floor(layer.x);
                  const y = Math.floor(layer.y);
                  const width = Math.floor(layer.width);
                  const height = Math.floor(layer.height);
                  
                  ctx.beginPath();
                  ctx.moveTo(x + r, y);
                  ctx.lineTo(x + width - r, y);
                  ctx.arcTo(x + width, y, x + width, y + r, r);
                  ctx.lineTo(x + width, y + height - r);
                  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
                  ctx.lineTo(x + r, y + height);
                  ctx.arcTo(x, y + height, x, y + height - r, r);
                  ctx.lineTo(x, y + r);
                  ctx.arcTo(x, y, x + r, y, r);
                  ctx.closePath();
                  ctx.fill();
                } else {
                  // Draw normal rectangle with pixel-perfect coordinates
                  ctx.fillRect(
                    Math.floor(layer.x), 
                    Math.floor(layer.y), 
                    Math.floor(layer.width), 
                    Math.floor(layer.height)
                  );
                }
              } else if (layer.src) {
                try {
                  const dataUrl = await loadImageAsDataURL(layer.src);
                  const img = new Image();
                  img.crossOrigin = "anonymous";
                  img.src = dataUrl;
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                  });
                  
                  // Handle any effects for image layers
                  if (layer.effect && layer.effect !== 'none') {
                    // Create a temporary canvas to apply effects
                    const effectCanvas = document.createElement('canvas');
                    effectCanvas.width = layer.width;
                    effectCanvas.height = layer.height;
                    const effectCtx = effectCanvas.getContext('2d');
                    
                    if (effectCtx) {
                      // Draw the image first
                      effectCtx.drawImage(img, 0, 0, layer.width, layer.height);
                      
                      // Apply the effect overlay
                      const patternSize = 20; // Size of the pattern tile
                      const patternCanvas = document.createElement('canvas');
                      patternCanvas.width = patternSize;
                      patternCanvas.height = patternSize;
                      const patternCtx = patternCanvas.getContext('2d');
                      
                      if (patternCtx) {
                        // Create a semi-transparent overlay with the effect
                        patternCtx.fillStyle = 'rgba(0,0,0,0.2)'; // Darkened background
                        patternCtx.fillRect(0, 0, patternSize, patternSize);
                        
                        // Draw the pattern based on effect type
                        patternCtx.strokeStyle = '#ffffff';
                        patternCtx.fillStyle = '#ffffff';
                        patternCtx.globalAlpha = 0.3;
                        
                        switch(layer.effect) {
                          case 'dots':
                            patternCtx.beginPath();
                            patternCtx.arc(patternSize/2, patternSize/2, patternSize/6, 0, Math.PI * 2);
                            patternCtx.fill();
                            break;
                            
                          case 'lines':
                            patternCtx.lineWidth = 2;
                            patternCtx.beginPath();
                            patternCtx.moveTo(0, 0);
                            patternCtx.lineTo(patternSize, patternSize);
                            patternCtx.stroke();
                            break;
                            
                          case 'waves':
                            patternCtx.lineWidth = 2;
                            patternCtx.beginPath();
                            patternCtx.moveTo(0, patternSize/2);
                            patternCtx.quadraticCurveTo(
                              patternSize/4, patternSize/4,
                              patternSize/2, patternSize/2
                            );
                            patternCtx.quadraticCurveTo(
                              3*patternSize/4, 3*patternSize/4,
                              patternSize, patternSize/2
                            );
                            patternCtx.stroke();
                            break;
                            
                          case 'grid':
                            patternCtx.lineWidth = 1;
                            patternCtx.beginPath();
                            patternCtx.moveTo(0, 0);
                            patternCtx.lineTo(0, patternSize);
                            patternCtx.moveTo(0, 0);
                            patternCtx.lineTo(patternSize, 0);
                            patternCtx.stroke();
                            break;
                            
                          case 'checkerboard':
                            patternCtx.globalAlpha = 0.2;
                            patternCtx.fillRect(0, 0, patternSize/2, patternSize/2);
                            patternCtx.fillRect(patternSize/2, patternSize/2, patternSize/2, patternSize/2);
                            break;
                        }
                        
                        // Apply the pattern overlay to the image
                        const pattern = effectCtx.createPattern(patternCanvas, 'repeat');
                        if (pattern) {
                          effectCtx.globalCompositeOperation = 'source-atop';
                          effectCtx.fillStyle = pattern;
                          effectCtx.fillRect(0, 0, layer.width, layer.height);
                        }
                      }
                      
                      // Handle corner radius for effected images
                      if (layer.cornerRadius > 0) {
                        ctx.save();
                        applyCornerRadius(ctx, layer);
                      }
                      
                      // Draw the effected image
                      ctx.drawImage(effectCanvas, layer.x, layer.y);
                      
                      if (layer.cornerRadius > 0) {
                        ctx.restore();
                      }
                    } else {
                      // Fallback if effect context couldn't be created
                      if (layer.cornerRadius > 0) {
                        ctx.save();
                        // Apply standard corner radius
                        applyCornerRadius(ctx, layer);
                      }
                      
                      ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
                      
                      if (layer.cornerRadius > 0) {
                        ctx.restore();
                      }
                    }
                  } else {
                    // Standard rendering without effects
                    // Handle corner radius if specified
                    if (layer.cornerRadius > 0) {
                      ctx.save();
                      // Apply corner radius
                      applyCornerRadius(ctx, layer);
                    }
                    
                    ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
                    
                    if (layer.cornerRadius > 0) {
                      ctx.restore();
                    }
                  }
                } catch {
                  // Draw placeholder on error
                  ctx.fillStyle = '#cccccc';
                  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                }
              }
              break;
              
            case 'text':
              // Handle text with exact same rendering as frontend
              const fontSize = layer.size || 16;
              const fontFamily = layer.font || 'Arial';
              const fontStyle = [];
              
              if (layer.italic) fontStyle.push('italic');
              if (layer.bold) fontStyle.push('bold');
              
              // Set font with proper formatting exactly as in frontend
              const fontString = \`\${fontStyle.join(' ')} \${fontSize}px \${fontFamily}\`;
              ctx.font = fontString;
              
              // Ensure the font is loaded and measured correctly
              document.fonts.load(fontString).then(() => {
                console.log(\`Font loaded: \${fontString}\`);
              });
              
              ctx.fillStyle = layer.color || '#000000';
              ctx.textBaseline = 'top'; // consistent baseline
              
              // If background is enabled, draw it first with exact same dimensions
              if (layer.useBackground) {
                ctx.fillStyle = layer.backgroundColor || '#ffffff';
                const padding = layer.bgPadding || 0;
                
                // Use exact same dimensions for the background
                ctx.fillRect(
                  Math.round(layer.x - padding), 
                  Math.round(layer.y - padding), 
                  Math.round(layer.width + (padding * 2)),
                  Math.round(layer.height + (padding * 2))
                );
              }
              
              // Calculate text metrics and position
              ctx.fillStyle = layer.color || '#000000';
              
              // Handle text alignment if specified
              let textAlign = layer.textAlign || 'left';
              ctx.textAlign = textAlign;
              
              // Calculate horizontal position based on alignment with pixel-perfect rounding
              let alignedX = Math.round(layer.x);
              if (textAlign === 'center') {
                alignedX = Math.round(layer.x + (layer.width / 2));
              } else if (textAlign === 'right') {
                alignedX = Math.round(layer.x + layer.width);
              }
              
              // Use the exact same word wrapping algorithm as frontend
              const words = layer.text.split(' ');
              let line = '';
              let lineY = Math.round(layer.y); // Ensure pixel-perfect positioning
              const lineHeight = Math.round(fontSize * 1.2); // Use the same line height calculation
              
              // Exact same word-wrap algorithm with pixel rounding for consistency
              for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > layer.width && i > 0) {
                  // Draw with pixel-perfect positioning
                  ctx.fillText(line.trim(), alignedX, lineY);
                  line = words[i] + ' ';
                  lineY += lineHeight;
                } else {
                  line = testLine;
                }
              }
              
              // Draw the last line with proper alignment
              ctx.fillText(line.trim(), alignedX, lineY);
              break;
          }
          
          // Draw border if set
          if (layer.borderWidth > 0) {
            ctx.strokeStyle = layer.borderColor || '#000000';
            ctx.lineWidth = layer.borderWidth;
            
            // Handle rounded corners for borders
            if (layer.cornerRadius > 0) {
              // Draw a rounded rectangle path for the border
              const r = layer.cornerRadius;
              
              // Calculate pixel-perfect coordinates to avoid blurry borders
              // Offset by half pixel for sharp lines when border width is odd
              const offset = layer.borderWidth % 2 === 1 ? 0.5 : 0;
              const x = Math.floor(layer.x) + offset;
              const y = Math.floor(layer.y) + offset;
              const width = Math.floor(layer.width);
              const height = Math.floor(layer.height);
              
              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + width - r, y);
              ctx.arcTo(x + width, y, x + width, y + r, r);
              ctx.lineTo(x + width, y + height - r);
              ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
              ctx.lineTo(x + r, y + height);
              ctx.arcTo(x, y + height, x, y + height - r, r);
              ctx.lineTo(x, y + r);
              ctx.arcTo(x, y, x + r, y, r);
              ctx.closePath();
              ctx.stroke();
            } else {
              // Use standard rectangle stroke for non-rounded corners
              // Add pixel-perfect alignment here too
              const offset = layer.borderWidth % 2 === 1 ? 0.5 : 0;
              ctx.strokeRect(
                Math.floor(layer.x) + offset, 
                Math.floor(layer.y) + offset, 
                Math.floor(layer.width), 
                Math.floor(layer.height)
              );
            }
          }
          
          // Reset alpha
          ctx.globalAlpha = 1;
        }
        
        // Add debug information if in debug mode
        if (debugMode) {
          // Draw debug info in the corner
          ctx.font = '12px Arial';
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(10, canvas.height - 70, 300, 60);
          ctx.fillStyle = 'white';
          ctx.fillText('API Render | Layers: ' + data.layers.length, 15, canvas.height - 50);
          ctx.fillText('Canvas: ' + canvas.width + 'x' + canvas.height, 15, canvas.height - 35);
          ctx.fillText('Generated: ' + new Date().toISOString(), 15, canvas.height - 20);
        }
        
        // Return PNG data URL
        return canvas.toDataURL('image/png');
      }

      // Process and return the data
      window.renderResult = renderTemplate(${JSON.stringify(templateData)});
    `;

    // Inject and run the script
    await page.addScriptTag({ content: renderingScript });

    // Wait for rendering to complete and get the result with timeout
    const imageDataUrl = await page.evaluate(() => {
      // @ts-expect-error -- window.renderResult is defined in our injected script
      return window.renderResult;
    }, { timeout: 30000 });
    
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      throw new Error('Failed to generate image: Invalid data URL returned');
    }
    
    // Convert base64 to buffer
    const base64Data = imageDataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Failed to extract base64 data from image');
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Success path - return the buffer
    return buffer;
  } catch (error) {
    console.error('Error in renderImageFromJSON:', error);
    
    // Try to provide detailed error information
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = `${error.name}: ${error.message}`;
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } else {
      errorMessage = String(error);
    }
    
    throw new Error(`Failed to render image: ${errorMessage}`);
  } finally {
    // Always close the browser, whether successful or not
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  // Allow CORS
  const allowedOrigins = [
    'http://localhost:3000', 
    'https://localhost:3000', 
    process.env.SITE_URL || '' // Your deployed site URL from env vars
  ].filter(Boolean);
  
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400' // 24 hours
      }
    });
  }
  
  try {
    // Extract query parameters
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') === 'true';
    const disableEffects = searchParams.get('noeffects') === 'true';
    
    // Parse JSON data from request
    const jsonData = await req.json();
    
    // Validate request data
    if (!jsonData || typeof jsonData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON data' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!jsonData.canvasWidth || !jsonData.canvasHeight || !jsonData.layers) {
      return NextResponse.json(
        { error: 'Missing required fields: canvasWidth, canvasHeight, and layers are required' },
        { status: 400 }
      );
    }
    
    // Add debug flag if requested
    const templateDataWithOptions = {
      ...jsonData as TemplateData,
      debug,
    };
    
    // Modify layers to remove effects if that option is enabled
    if (disableEffects && Array.isArray(templateDataWithOptions.layers)) {
      templateDataWithOptions.layers = templateDataWithOptions.layers.map(layer => {
        if (layer.type === 'image' && layer.effect) {
          return {
            ...layer,
            effect: 'none'
          };
        }
        return layer;
      });
    }
    
    // Generate the image
    const imageBuffer = await renderImageFromJSON(templateDataWithOptions);
    
    // Return the image as a response
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="template.png"',
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'public, max-age=3600' // Allow caching for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Check if this is a Playwright installation error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Executable doesn't exist") || 
        errorMessage.includes("Please run the following command to download new browsers")) {
      return NextResponse.json(
        { 
          error: 'Server configuration error: Playwright browsers not installed',
          details: errorMessage
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
} 