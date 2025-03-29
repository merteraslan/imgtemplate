import { NextRequest, NextResponse } from 'next/server';
import { TemplateData, Layer, ImageLayer } from '@/types/templateTypes';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fetch from 'node-fetch'; // Or use native fetch if Node v18+

// Configure route segment for longer processing
export const maxDuration = 300; // 300 seconds timeout (Adjust as needed/allowed by plan)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// --- Helper Function to fetch/convert URLs (Runs inside API route) ---
async function convertUrlsToDataUrls(templateData: TemplateData): Promise<TemplateData> {
    console.time('imagePrefetching'); // Start timing
    const updatedData = JSON.parse(JSON.stringify(templateData)); // Deep copy
    const urlsToFetch: { id: string | 'background'; url: string }[] = [];
    const urlMap = new Map<string, { id: string | 'background'; url: string }>(); // To avoid fetching the same URL multiple times

    // Identify unique URLs
    if (updatedData.backgroundImage && updatedData.backgroundImage.startsWith('http')) {
        if (!urlMap.has(updatedData.backgroundImage)) {
            const entry = { id: 'background', url: updatedData.backgroundImage };
            urlsToFetch.push(entry);
            urlMap.set(updatedData.backgroundImage, entry);
        }
    }
    if (updatedData.layers) {
        updatedData.layers.forEach((layer: Layer) => { // Explicitly type layer
            if (layer.type === 'image' && (layer as ImageLayer).src && (layer as ImageLayer).src.startsWith('http')) {
                const src = (layer as ImageLayer).src;
                 if (!urlMap.has(src)) {
                    const entry = { id: layer.id, url: src }; // Use layer ID for tracking initially
                    urlsToFetch.push(entry);
                    urlMap.set(src, entry); // Map original URL to its first occurrence info
                 }
            }
        });
    }

    if (urlsToFetch.length === 0) {
        console.timeEnd('imagePrefetching');
        return updatedData; // No external URLs
    }

    console.log(`Fetching ${urlsToFetch.length} unique external image URL(s)...`);

    // Fetch concurrently
    const fetchPromises = urlsToFetch.map(async ({ url }) => { // Only need URL for fetching
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(25000), // 25-second timeout per image fetch
                headers: { 'User-Agent': 'ImageTemplateApp/1.0 (+https://your-app-url.com)' } // Be a good citizen
            });
            if (!response.ok) {
                throw new Error(`Status ${response.status}`);
            }
            const buffer = await response.buffer();
            const contentType = response.headers.get('content-type') || 'image/png';
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${contentType};base64,${base64}`;
            console.log(`Fetched: ${url.substring(0, 50)}...`);
            return { originalUrl: url, dataUrl, success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to fetch image ${url}:`, errorMessage);
            return { originalUrl: url, dataUrl: null, success: false, error: errorMessage };
        }
    });

    const results = await Promise.allSettled(fetchPromises);

    // Create a map of original URL -> result data URL (or null on failure)
    const dataUrlResults = new Map<string, string | null>();
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            dataUrlResults.set(result.value.originalUrl, result.value.success ? result.value.dataUrl : null);
        } else if (result.status === 'rejected') {
            console.error('Unexpected image fetch rejection:', result.reason);
            // Cannot map result.reason.originalUrl reliably here, so failed URLs won't be mapped
        }
    });

     // Update the templateData with the results
     if (updatedData.backgroundImage && updatedData.backgroundImage.startsWith('http')) {
         const resultDataUrl = dataUrlResults.get(updatedData.backgroundImage);
         if (resultDataUrl) { // Only update if successfully fetched
             updatedData.backgroundImage = resultDataUrl;
         } else if (resultDataUrl === null) { // Fetch failed
             console.warn(`Failed fetch for background image, keeping original URL: ${updatedData.backgroundImage}`);
             // Optional: Set to empty string or placeholder? updatedData.backgroundImage = '';
         }
     }
     if (updatedData.layers) {
         updatedData.layers = updatedData.layers.map((layer: Layer) => { // Explicitly type layer
             if (layer.type === 'image' && (layer as ImageLayer).src && (layer as ImageLayer).src.startsWith('http')) {
                 const originalSrc = (layer as ImageLayer).src;
                 const resultDataUrl = dataUrlResults.get(originalSrc);
                 if (resultDataUrl) { // Successfully fetched
                     return { ...layer, src: resultDataUrl };
                 } else if (resultDataUrl === null) { // Fetch failed
                      console.warn(`Failed fetch for layer ${layer.id}, keeping original URL: ${originalSrc}`);
                     // Optional: Set src to empty string? return { ...layer, src: '' };
                     return layer; // Keep original layer object
                 }
             }
             return layer;
         });
     }

    console.timeEnd('imagePrefetching');
    return updatedData;
}

// --- Render function (largely unchanged from previous answer, uses data URLs) ---
async function renderImageFromJSON(templateData: TemplateData): Promise<Buffer> {
    console.time('puppeteerRender'); // Start timing
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({ /* ... browser args ... */
            headless: true,
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
            executablePath: await chromium.executablePath(),
            defaultViewport: {
                width: templateData.canvasWidth ?? 1080,
                height: templateData.canvasHeight ?? 1080,
                deviceScaleFactor: 2
            }
        });
        page = await browser.newPage();
        await page.setJavaScriptEnabled(true);

        const html = `<html>
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
      </html>`; // Same HTML structure as before
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 }); // Adjusted timeout
        await page.evaluate(() => document.fonts.ready); // Wait for fonts

        // --- SIMPLIFIED Rendering Script (no loadImageAsDataURL needed) ---
        const renderingScript = `
            async function loadImageFromSource(src) {
                // Now expects data URLs mostly, but handles fallback/errors
                return new Promise((resolve, reject) => {
                  // Allow non-data URLs if prefetch failed, but log warning
                  if (src && src.startsWith('http')) {
                    console.warn('Rendering with original HTTP URL (prefetch likely failed):', src.substring(0,50)+'...');
                    // Fallback: try loading it directly (might taint canvas or fail)
                     const img = new Image();
                     img.crossOrigin = "anonymous"; // Attempt anonymous loading
                     img.onload = () => resolve(img);
                     img.onerror = (err) => {
                       console.error('Error loading fallback HTTP image in browser:', src.substring(0, 50) + '...');
                       resolve(null); // Resolve null on error
                     };
                     img.src = src;
                     return; // Exit promise flow here for http case
                  } else if (!src || !src.startsWith('data:image')) {
                     console.warn('Invalid or missing image source for rendering:', src ? src.substring(0, 50) + '...' : 'null');
                     resolve(null); // Resolve null for invalid sources
                     return;
                  }

                  // Proceed with loading data URL
                  const img = new Image();
                  img.onload = () => resolve(img);
                  img.onerror = (err) => {
                      console.error('Error loading image object from data URL:', src.substring(0, 50) + '...');
                      resolve(null); // Resolve null on error
                  };
                  img.src = src;
                });
            }

            async function renderTemplate(data) {
                const canvas = document.getElementById('renderCanvas');
                const ctx = canvas.getContext('2d', { alpha: true, antialias: true });
                if (!ctx) throw new Error('Failed to get canvas context');
                // ... Set smoothing, rendering properties ...

                // Set consistent text rendering params
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.textRendering = 'geometricPrecision';

                // --- Draw Background ---
                if (data.backgroundImage) {
                    try {
                        const img = await loadImageFromSource(data.backgroundImage);
                        if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        else console.warn('Background image source invalid/failed.');
                    } catch (err) { console.warn('Failed to draw background image:', err); }
                } else {
                  // Ensure canvas is cleared/has white background if no bg image
                   ctx.fillStyle = 'white';
                   ctx.fillRect(0, 0, canvas.width, canvas.height);
                }


                // --- Layer Rendering Loop ---
                let layersToRender = (data.layers || []).slice().reverse().filter(l => l.visible);
                for (const layer of layersToRender) {
                     ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;

                     switch(layer.type) {
                        case 'image':
                            if (layer.useColorFill) {
                                // Draw color fill
                                ctx.fillStyle = layer.fillColor || '#cccccc';
                                
                                if (layer.cornerRadius > 0) {
                                  // Create rounded rectangle if needed
                                  ctx.save();
                                  // Helper function to create rounded rectangle clipping path
                                  const r = layer.cornerRadius;
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
                                  ctx.fill();
                                  ctx.restore();
                                } else {
                                  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                                }
                                
                                // Handle pattern effects for filled images if needed
                                if (layer.effect && layer.effect !== 'none') {
                                  // Draw patterns based on effect type
                                  const patternSize = 20;
                                  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                                  ctx.lineWidth = 1;
                                  
                                  // Basic pattern code would go here - simplified for this example
                                  if (layer.effect === 'dots') {
                                    // Draw dot pattern
                                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                                    for (let x = layer.x + 5; x < layer.x + layer.width; x += patternSize) {
                                      for (let y = layer.y + 5; y < layer.y + layer.height; y += patternSize) {
                                        ctx.beginPath();
                                        ctx.arc(x, y, 2, 0, Math.PI * 2);
                                        ctx.fill();
                                      }
                                    }
                                  }
                                  // Additional patterns would be implemented here
                                }
                            } else if (layer.src) {
                                try {
                                    const img = await loadImageFromSource(layer.src);
                                    if (!img) {
                                        // Draw placeholder if image failed to load
                                        console.warn(\`Drawing placeholder for layer \${layer.id} - source invalid/failed.\`)
                                        ctx.fillStyle = '#cccccc';
                                        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                                        // Draw 'X'
                                        ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 2; ctx.beginPath();
                                        ctx.moveTo(layer.x, layer.y); ctx.lineTo(layer.x + layer.width, layer.y + layer.height);
                                        ctx.moveTo(layer.x + layer.width, layer.y); ctx.lineTo(layer.x, layer.y + layer.height);
                                        ctx.stroke();
                                    } else {
                                        // Draw the actual image
                                        if (layer.cornerRadius > 0) {
                                          ctx.save();
                                          // Create rounded rectangle clip path
                                          const r = layer.cornerRadius;
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
                                          ctx.clip();
                                          ctx.drawImage(img, x, y, width, height);
                                          ctx.restore();
                                        } else {
                                          ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
                                        }
                                    }
                                } catch(error) {
                                    console.error(\`Error rendering image layer \${layer.id}:\`, error);
                                    // Draw placeholder on unexpected error
                                    ctx.fillStyle = '#cccccc'; ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                                }
                            }
                            break;
                         case 'text':
                             // Draw text layer
                             ctx.font = \`\${layer.bold ? 'bold ' : ''}\${layer.italic ? 'italic ' : ''}\${layer.size}px \${layer.font || 'Arial'}\`;
                             ctx.fillStyle = layer.color || '#000000';
                             ctx.textAlign = layer.textAlign || 'left';
                             
                             // Calculate text position based on alignment
                             let textX = layer.x;
                             if (layer.textAlign === 'center') textX += layer.width / 2;
                             else if (layer.textAlign === 'right') textX += layer.width;
                             
                             // Draw background if enabled
                             if (layer.useBackground && layer.backgroundColor) {
                               const padding = layer.bgPadding || 5;
                               ctx.fillStyle = layer.backgroundColor;
                               ctx.fillRect(
                                 layer.x - padding, 
                                 layer.y - padding, 
                                 layer.width + (padding * 2), 
                                 layer.height + (padding * 2)
                               );
                               ctx.fillStyle = layer.color || '#000000';
                             }
                             
                             // Draw the text
                             ctx.fillText(layer.text, textX, layer.y + layer.size);
                             break;
                         case 'shape':
                             // Draw shape layer
                             ctx.fillStyle = layer.fillColor || '#000000';
                             ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                             
                             if (layer.strokeWidth > 0) {
                               ctx.strokeStyle = layer.strokeColor || '#000000';
                               ctx.lineWidth = layer.strokeWidth;
                               ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
                             }
                             break;
                     }
                     
                     // Draw border if specified
                     if (layer.borderWidth > 0 && layer.borderColor) {
                       ctx.strokeStyle = layer.borderColor;
                       ctx.lineWidth = layer.borderWidth;
                       
                       if (layer.cornerRadius > 0 && layer.type === 'image') {
                         // Draw rounded rectangle border
                         const r = layer.cornerRadius;
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
                         ctx.stroke();
                       } else {
                         // Standard rectangle border
                         ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
                       }
                     }
                     ctx.globalAlpha = 1; // Reset alpha
                 }

                // Add debug info if enabled
                if (data.debug) {
                  ctx.fillStyle = 'rgba(0,0,0,0.7)';
                  ctx.fillRect(10, 10, 230, 80);
                  ctx.font = '14px monospace';
                  ctx.fillStyle = 'white';
                  ctx.textAlign = 'left';
                  ctx.fillText(\`Canvas: \${canvas.width}x\${canvas.height}\`, 20, 30);
                  ctx.fillText(\`Layers: \${layersToRender.length}\`, 20, 50);
                  ctx.fillText(\`Rendered: \${new Date().toISOString()}\`, 20, 70);
                }

                return canvas.toDataURL('image/png');
            }
            window.renderResult = renderTemplate(${JSON.stringify(templateData)}); // Pass data with dataURLs
        `;
        // --- END SIMPLIFIED Rendering Script ---

        await page.addScriptTag({ content: renderingScript });
        // Use a proper type cast approach for evaluating window properties
        const imageDataUrl = await page.evaluate(() => {
            // Cast to unknown first, then to the desired type
            return (window as unknown as { renderResult: string }).renderResult;
        }, { timeout: 90000 }); // Generous evaluate timeout

        if (!imageDataUrl || typeof imageDataUrl !== 'string') throw new Error('Invalid data URL returned');
        const base64Data = imageDataUrl.split(',')[1];
        if (!base64Data) throw new Error('Failed to extract base64 data');

        console.timeEnd('puppeteerRender');
        return Buffer.from(base64Data, 'base64');

    } catch (error) {
        console.error('Error in renderImageFromJSON:', error);
        if (page) {
            try {
                const screenshot = await page.screenshot({ encoding: 'base64' });
                console.error("Puppeteer Screenshot (base64):", screenshot.substring(0, 200) + '...');
            } catch (ssError) { console.error("Failed to get screenshot:", ssError); }
        }
        throw error; // Re-throw
    } finally {
        console.timeEnd('puppeteerRender'); // End timer even on error
        if (browser) {
            try { await browser.close(); }
            catch (closeError) { console.error('Error closing browser:', closeError); }
        }
    }
}

// --- POST Handler ---
export async function POST(req: NextRequest) {
    console.log("generate-image API called");
    // API Key Validation... (same as before)
    const apiKey = req.headers.get('x-api-key');
    const validApiKey = process.env.API_KEY;
    if (!validApiKey || apiKey !== validApiKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CORS Headers... (same as before)
    const allowedOrigins = [process.env.SITE_URL || ''].filter(Boolean);
    const origin = req.headers.get('origin') || '';
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const corsHeaders = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Allow-Credentials': 'true'
    };

    if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { searchParams } = new URL(req.url);
        const debug = searchParams.get('debug') === 'true';

        const jsonData = await req.json();
        if (!jsonData || typeof jsonData !== 'object' || !jsonData.canvasWidth || !jsonData.canvasHeight || !jsonData.layers) {
            return NextResponse.json({ error: 'Invalid JSON data or missing fields' }, { status: 400, headers: corsHeaders });
        }

        // --- Convert URLs inside the handler ---
        const templateDataWithDataUrls = await convertUrlsToDataUrls(jsonData as TemplateData);
        // --- ---

        const templateDataWithOptions = {
            ...templateDataWithDataUrls,
            debug
        };

        console.log("Starting image generation with Puppeteer...");
        const imageBuffer = await renderImageFromJSON(templateDataWithOptions);
        console.log("Image generation complete.");

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'image/png',
                'Content-Disposition': 'attachment; filename="generated_image.png"',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error) {
        console.error('Error in POST /api/generate-image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
        return NextResponse.json(
            { error: errorMessage, details: error instanceof Error ? error.stack : null },
            { status: 500, headers: corsHeaders }
        );
    }
} 