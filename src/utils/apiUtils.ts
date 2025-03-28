import { TemplateData } from '@/types/templateTypes';

// Session token cache
let sessionToken: { token: string; expires: number } | null = null;

/**
 * Gets a valid session token, either from cache or by requesting a new one
 * @returns A Promise that resolves to a session token
 */
async function getSessionToken(): Promise<string> {
  const now = Date.now();
  
  // Check if we have a valid cached token
  if (sessionToken && sessionToken.expires > now + 60000) { // Valid for more than 1 minute
    return sessionToken.token;
  }
  
  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  
  // Request a new token
  try {
    const response = await fetch('/api/validate-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get session token: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the token
    sessionToken = {
      token: data.token,
      expires: data.expires
    };
    
    return data.token;
  } catch (error) {
    console.error('Error getting session token:', error);
    throw error;
  }
}

/**
 * Calls the image generation API with template data and returns a PNG blob
 * @param templateData The template data to generate an image from
 * @returns A Promise that resolves to a Blob containing the PNG image
 */
export async function generateImageFromAPI(templateData: TemplateData): Promise<Blob> {
  try {
    // Get a valid session token
    const token = await getSessionToken();

    // Call the image generation API endpoint
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
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