"use client";

import { TemplateData } from '@/types/templateTypes';

/**
 * Calls the image generation API with template data and returns a PNG blob
 * @param templateData The template data to generate an image from
 * @returns A Promise that resolves to a Blob containing the PNG image
 */
export async function generateImageFromAPI(templateData: TemplateData): Promise<Blob> {
  try {
    // Get the API key from environment variable or localStorage
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || localStorage.getItem('api_key');
    
    // Call the image generation API endpoint
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
      body: JSON.stringify(templateData),
    });

    // Check if the response was successful
    if (!response.ok) {
      // Try to parse the error response
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || `API responded with status ${response.status}`
      );
    }

    // Return the blob directly since the API returns an image
    return await response.blob();
  } catch (error) {
    console.error('Error generating image from API:', error);
    throw error;
  }
}

/**
 * Generates an image from template data and triggers a download
 * @param templateData The template data to generate an image from
 * @param filename The filename for the downloaded image (default: 'template.png')
 */
export async function downloadImageFromAPI(
  templateData: TemplateData, 
  filename: string = 'template.png'
): Promise<void> {
  try {
    // Get the image blob from the API
    const blob = await generateImageFromAPI(templateData);
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element to download the file
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click, and clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Release the blob URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

/**
 * Sets the API key in localStorage for client-side storage
 * @param key The API key to store
 */
export function setApiKey(key: string): void {
  localStorage.setItem('api_key', key);
}

/**
 * Gets the API key from localStorage
 * @returns The stored API key or null if not set
 */
export function getApiKey(): string | null {
  return localStorage.getItem('api_key');
} 