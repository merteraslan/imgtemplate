import { NextRequest, NextResponse } from 'next/server';
import { TemplateData, Layer, ImageLayer } from '@/types/templateTypes';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
// Native fetch is available in Node.js v18+ and Next.js environments

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
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
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

    // --- Determine Base URL for Fonts ---
    // Use Vercel URL if available (includes http/https), otherwise default to localhost for dev
    // Ensure NEXT_PUBLIC_APP_URL is set in your .env.local for local testing if needed
    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 
    // --- End Base URL Logic ---

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
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&display=swap" rel="stylesheet">
          <!-- Add Impact font and other display fonts -->
          <style>
            /* You might still keep Impact / Arial Black local if needed, or add them via Fontsource/public */
            @font-face {
              font-family: 'Impact';
              src: local('Impact'); /* Assuming Impact is often installed */
              font-display: block;
            }
            
            /* Backup for Impact */
            @font-face {
              font-family: 'Arial Black';
              src: local('Arial Black'); /* Assuming Arial Black is often installed */
              font-display: block;
            }
            
            /* Load fonts explicitly from /public/fonts using absolute URLs */
            @font-face { font-family: 'Arimo'; src: url(${baseUrl}/fonts/arimo-latin-400-normal.woff2) format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
            @font-face { font-family: 'Arimo'; src: url(${baseUrl}/fonts/arimo-latin-700-normal.woff2) format('woff2'); font-weight: 700; font-style: normal; font-display: block; }
            @font-face { font-family: 'Inter'; src: url(${baseUrl}/fonts/inter-latin-400-normal.woff2) format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
            @font-face { font-family: 'Inter'; src: url(${baseUrl}/fonts/inter-latin-700-normal.woff2) format('woff2'); font-weight: 700; font-style: normal; font-display: block; }
            @font-face { font-family: 'Tinos'; src: url(${baseUrl}/fonts/tinos-latin-400-normal.woff2) format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
            @font-face { font-family: 'Tinos'; src: url(${baseUrl}/fonts/tinos-latin-700-normal.woff2) format('woff2'); font-weight: 700; font-style: normal; font-display: block; }
            @font-face { font-family: 'Cousine'; src: url(${baseUrl}/fonts/cousine-latin-400-normal.woff2) format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
            @font-face { font-family: 'Cousine'; src: url(${baseUrl}/fonts/cousine-latin-700-normal.woff2) format('woff2'); font-weight: 700; font-style: normal; font-display: block; }
            /* Add any other fonts from public/fonts here */
          </style>
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
          <div style="position: absolute; visibility: hidden; font-family: 'Impact'; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: 'Arial Black'; font-size: 0;">.</div>
          <div style="position: absolute; visibility: hidden; font-family: 'Verdana'; font-size: 0;">.</div>
        </body>
      </html>`; // Same HTML structure as before
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 }); // Adjusted timeout
        await page.evaluate(() => document.fonts.ready); // Wait for fonts
        // Add an explicit delay for fonts using evaluate
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

        // Add font loading diagnostics
        await page.evaluate(() => {
          console.log('Checking computed font styles after document.fonts.ready...');
          const fontsToTest = ['Arimo', 'Inter', 'Tinos', 'Cousine', 'Impact', 'Arial Black'];
          const results: { [key: string]: string } = {};
          fontsToTest.forEach(font => {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.left = '-9999px'; // Hide off-screen
            el.style.fontFamily = `"${font}"`; // Apply specific font
            el.textContent = 'test';
            document.body.appendChild(el);
            results[font] = window.getComputedStyle(el).fontFamily;
            document.body.removeChild(el); // Clean up
          });
          console.log('Computed font families:', JSON.stringify(results));
          // Note: This check doesn't guarantee rendering correctness but indicates if the browser *recognizes* the font.
        });

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
                ctx.textBaseline = 'top';

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
                                  ctx.save();

                                  // Apply clipping for rounded corners before drawing pattern
                                  if (layer.cornerRadius > 0) {
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
                                    ctx.clip(); // Clip subsequent drawing to this path
                                  }

                                  ctx.globalAlpha = 0.3;
                                  ctx.strokeStyle = '#ffffff';
                                  ctx.fillStyle = '#ffffff';

                                  // Basic pattern code
                                  if (layer.effect === 'dots') {
                                    for (let x = layer.x + patternSize / 2; x < layer.x + layer.width; x += patternSize) {
                                      for (let y = layer.y + patternSize / 2; y < layer.y + layer.height; y += patternSize) {
                                        const dotRadius = patternSize / 6;
                                        if (x - dotRadius >= layer.x && x + dotRadius <= layer.x + layer.width && y - dotRadius >= layer.y && y + dotRadius <= layer.y + layer.height) {
                                            ctx.beginPath();
                                            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                                            ctx.fill();
                                        }
                                      }
                                    }
                                  } else if (layer.effect === 'lines') {
                                    // Draw diagonal lines pattern
                                    ctx.beginPath();
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
                                    ctx.stroke();
                                  } else if (layer.effect === 'waves') {
                                    // Draw wave pattern using a temporary canvas for better clipping
                                    const waveHeight = patternSize / 4;
                                    // Create a temporary canvas matching the layer size
                                    const tempCanvas = document.createElement('canvas');
                                    tempCanvas.width = Math.floor(layer.width);
                                    tempCanvas.height = Math.floor(layer.height);
                                    const tempCtx = tempCanvas.getContext('2d');

                                    if (tempCtx) {
                                      tempCtx.strokeStyle = ctx.strokeStyle;
                                      tempCtx.fillStyle = ctx.fillStyle;
                                      tempCtx.lineWidth = 2;
                                      // Draw waves onto temp canvas relative to its origin (0,0)
                                      for (let y = 0; y < tempCanvas.height; y += patternSize) {
                                        tempCtx.beginPath();
                                        for (let x = 0; x < tempCanvas.width; x += patternSize) {
                                          if (x + patternSize <= tempCanvas.width) {
                                            tempCtx.moveTo(x, y + patternSize / 2);
                                            tempCtx.quadraticCurveTo(
                                              x + patternSize / 4, y + patternSize / 2 - waveHeight,
                                              x + patternSize / 2, y + patternSize / 2
                                            );
                                            tempCtx.quadraticCurveTo(
                                              x + 3 * patternSize / 4, y + patternSize / 2 + waveHeight,
                                              x + patternSize, y + patternSize / 2
                                            );
                                          }
                                        }
                                        tempCtx.stroke();
                                      }
                                      // Set alpha before drawing the temp canvas
                                      ctx.globalAlpha = 0.3;
                                      // Draw the temporary canvas onto the main context (respects clip)
                                      ctx.drawImage(tempCanvas, Math.floor(layer.x), Math.floor(layer.y));
                                      ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1; // Restore layer alpha if needed before next step
                                    } else {
                                      console.warn('Could not create temporary canvas for wave effect');
                                    }
                                  } else if (layer.effect === 'grid') {
                                    // Draw grid pattern
                                    ctx.beginPath();
                                    
                                    // Vertical lines
                                    for (let x = layer.x; x <= layer.x + layer.width; x += patternSize) {
                                      if (x >= layer.x && x <= layer.x + layer.width) {
                                        ctx.moveTo(x, layer.y);
                                        ctx.lineTo(x, layer.y + layer.height);
                                      }
                                    }
                                    
                                    // Horizontal lines
                                    for (let y = layer.y; y <= layer.y + layer.height; y += patternSize) {
                                      if (y >= layer.y && y <= layer.y + layer.height) {
                                        ctx.moveTo(layer.x, y);
                                        ctx.lineTo(layer.x + layer.width, y);
                                      }
                                    }
                                    
                                    ctx.lineWidth = 1;
                                    ctx.stroke();
                                  }
                                  // Additional patterns would be implemented here

                                  ctx.restore();
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
                             // Draw text layer with better font handling
                             // Special case handling for Impact/display fonts
                             // Use explicit weight 700 for bold, default 400 otherwise
                             const fontWeight = layer.bold ? '700 ' : '400 ';
                             const fontStyle = layer.italic ? 'italic ' : '';
                             const fontSize = layer.size + 'px';
                             const fontFamily = layer.font || 'Arimo'; // Default to Arimo (Arial replacement)
                             
                             // Build full font string with fallbacks
                              let fullFontFamily = '"' + fontFamily + '"';
                              if (fontFamily.toLowerCase().includes('impact')) {
                                 fullFontFamily += ', "Arial Black", sans-serif';
                              } else if (fontFamily.toLowerCase().includes('arial black')) {
                                 fullFontFamily += ', Impact, sans-serif';
                              } else if (fontFamily === 'Arimo' || fontFamily === 'Inter') {
                                 // Basic sans-serif fallback
                                 fullFontFamily += ', sans-serif';
                              } else if (fontFamily === 'Tinos') {
                                 // Basic serif fallback
                                 fullFontFamily += ', serif';
                              } else if (fontFamily === 'Cousine') {
                                 // Basic monospace fallback
                                 fullFontFamily += ', monospace';
                              } else {
                                 fullFontFamily += ', sans-serif';
                              }
                              
                              // Set complete font
                              ctx.font = fontStyle + fontWeight + fontSize + ' ' + fullFontFamily;
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
                              
                              // Improved text rendering with proper word wrapping
                              const words = layer.text.split(' ');
                              let line = '';
                              let lineY = layer.y;
                              const lineHeight = layer.size * 1.2; // Approximate line height
                              
                              for (let i = 0; i < words.length; i++) {
                                const testLine = line + words[i] + ' ';
                                const metrics = ctx.measureText(testLine);
                                
                                if (metrics.width > layer.width && i > 0) {
                                  // Draw current line and move to next line
                                  ctx.fillText(line, textX, lineY);
                                  line = words[i] + ' ';
                                  lineY += lineHeight;
                                  
                                  // Check if we've exceeded the height
                                  if (lineY + lineHeight > layer.y + layer.height) {
                                    break; // Stop rendering text if it exceeds the container height
                                  }
                                } else {
                                  line = testLine;
                                }
                              }
                              
                              // Draw the last line only if it fits
                              if (lineY + lineHeight <= layer.y + layer.height) {
                                ctx.fillText(line, textX, lineY);
                              }
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

        // console.timeEnd('puppeteerRender'); // REMOVED duplicate call
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
        // Ensure console.timeEnd is called exactly once
        if (browser) {
            try { await browser.close(); }
            catch (closeError) { console.error('Error closing browser:', closeError); }
            console.timeEnd('puppeteerRender'); // Moved here to ensure it runs after close attempt
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