# Standalone Serverless API Functions

This directory contains standalone serverless functions for Vercel deployment.

## Functions

### `generate.js`

A serverless function for image generation using Puppeteer and Chrome AWS Lambda.

**Endpoint:** `/api/generate-image`

**Method:** POST

**Headers:**

- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY`

**Request Body:**

```json
{
  "canvasWidth": 1080,
  "canvasHeight": 1080,
  "layers": [
    {
      "id": "text-1",
      "type": "text",
      "text": "Hello World",
      "x": 100,
      "y": 100,
      "width": 400,
      "height": 50,
      "color": "#000000",
      "font": "Arial",
      "size": 24,
      "visible": true
    }
  ]
}
```

**Response:**

PNG image with Content-Type: image/png

## Deployment

This function is designed to work with Vercel serverless environments and uses chrome-aws-lambda for browser automation.

The routing is configured in `vercel.json` to map the `/api/generate-image` path to this function.
