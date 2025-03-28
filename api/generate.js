const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");

// Function that draws the image directly using Puppeteer
async function renderImage(templateData) {
  let browser = null;

  try {
    // Launch Chrome
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: true,
    });

    // Create a new page
    const page = await browser.newPage();

    // Set viewport to match template dimensions
    await page.setViewport({
      width: templateData.canvasWidth || 1080,
      height: templateData.canvasHeight || 1080,
      deviceScaleFactor: 1,
    });

    // Create HTML content
    const html = `
      <html>
        <head>
          <style>
            body, html { 
              margin: 0; 
              padding: 0; 
              overflow: hidden;
            }
            #container { 
              width: ${templateData.canvasWidth || 1080}px; 
              height: ${templateData.canvasHeight || 1080}px; 
              background: white;
            }
            canvas { 
              display: block; 
            }
          </style>
        </head>
        <body>
          <div id="container">
            <canvas id="renderCanvas" width="${
              templateData.canvasWidth || 1080
            }" height="${templateData.canvasHeight || 1080}"></canvas>
          </div>
          <script>
            // Render the template
            const canvas = document.getElementById('renderCanvas');
            const ctx = canvas.getContext('2d');
            
            // Draw background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw each layer in reverse order (matching frontend)
            const layers = ${JSON.stringify(templateData.layers || [])};
            
            // Draw layers in reverse order
            for (const layer of layers.reverse().filter(l => l.visible)) {
              // Apply layer opacity
              ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
              
              if (layer.type === 'text') {
                // Render text
                const fontSize = layer.size || 16;
                const fontFamily = layer.font || 'Arial';
                const fontStyle = [];
                
                if (layer.italic) fontStyle.push('italic');
                if (layer.bold) fontStyle.push('bold');
                
                ctx.font = \`\${fontStyle.join(' ')} \${fontSize}px \${fontFamily}\`;
                ctx.fillStyle = layer.color || '#000000';
                ctx.textBaseline = 'top';
                
                // Background if needed
                if (layer.useBackground) {
                  ctx.fillStyle = layer.backgroundColor || '#ffffff';
                  const padding = layer.bgPadding || 0;
                  ctx.fillRect(
                    Math.round(layer.x - padding), 
                    Math.round(layer.y - padding), 
                    Math.round(layer.width + (padding * 2)),
                    Math.round(layer.height + (padding * 2))
                  );
                }
                
                // Draw text
                ctx.fillStyle = layer.color || '#000000';
                let textAlign = layer.textAlign || 'left';
                ctx.textAlign = textAlign;
                
                // Calculate horizontal position based on alignment
                let alignedX = Math.round(layer.x);
                if (textAlign === 'center') {
                  alignedX = Math.round(layer.x + (layer.width / 2));
                } else if (textAlign === 'right') {
                  alignedX = Math.round(layer.x + layer.width);
                }
                
                // Render simple text (no word wrap for simplicity)
                ctx.fillText(layer.text, alignedX, Math.round(layer.y));
              }
              else if (layer.type === 'image') {
                // For images we'll simply render a placeholder rectangle
                ctx.fillStyle = layer.useColorFill ? (layer.fillColor || '#cccccc') : '#eeeeee';
                
                // Draw rectangle
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
                  ctx.fill();
                } else {
                  ctx.fillRect(
                    Math.floor(layer.x), 
                    Math.floor(layer.y), 
                    Math.floor(layer.width), 
                    Math.floor(layer.height)
                  );
                }
              }
              
              // Draw border if set
              if (layer.borderWidth > 0) {
                ctx.strokeStyle = layer.borderColor || '#000000';
                ctx.lineWidth = layer.borderWidth;
                
                if (layer.cornerRadius > 0) {
                  const r = layer.cornerRadius;
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
            
            // Add debug watermark
            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillText('Generated via API', 10, canvas.height - 10);
          </script>
        </body>
      </html>
    `;

    // Set the content
    await page.setContent(html);

    // Wait for rendering to complete
    await page.waitForFunction("document.fonts.ready");

    // Take a screenshot
    const imageBuffer = await page.screenshot({
      type: "png",
      fullPage: false,
      omitBackground: false,
    });

    return imageBuffer;
  } catch (error) {
    console.error("Error rendering image:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Verify API key
function verifyApiKey(req) {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.warn("API_KEY not set. API is unprotected.");
    return true;
  }

  const authHeader = req.headers.authorization;
  return (
    authHeader &&
    authHeader.startsWith("Bearer ") &&
    authHeader.substring(7) === apiKey
  );
}

// Main handler
module.exports = async (req, res) => {
  // Check HTTP method
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify API key
  if (!verifyApiKey(req)) {
    res.status(401).json({ error: "Unauthorized: Invalid API key" });
    return;
  }

  try {
    // Parse JSON data from request
    const templateData = req.body;

    // Validate request data
    if (!templateData || typeof templateData !== "object") {
      res.status(400).json({ error: "Invalid JSON data" });
      return;
    }

    // Validate required fields
    if (
      !templateData.canvasWidth ||
      !templateData.canvasHeight ||
      !templateData.layers
    ) {
      res.status(400).json({
        error:
          "Missing required fields: canvasWidth, canvasHeight, and layers are required",
      });
      return;
    }

    // Generate the image
    const imageBuffer = await renderImage(templateData);

    // Set response headers
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'attachment; filename="template.png"');
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Send the image
    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
};
