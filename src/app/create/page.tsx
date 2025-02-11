'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FileImage } from 'lucide-react';
import React, { useState } from 'react';
import TemplateEditor from '@/components/TemplateEditor';

const JsonUploader = ({ onDataLoaded }: { onDataLoaded: (data: unknown) => void }) => {
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const handleFile = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      setIsLoading(false);
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        // Basic structure validation
        if (jsonData.canvasWidth && jsonData.canvasHeight && Array.isArray(jsonData.layers)) {
          onDataLoaded(jsonData);
        } else {
          setError('The JSON file structure is not correct.');
        }
      } catch {
        setError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    setError('');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="json-uploader">
      <div
        className={`drop-zone ${isDragActive ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragActive ? (
          <p>Drop the file here...</p>
        ) : (
          <p>Drag and drop your JSON file here, or click to select.</p>
        )}
        <input
          type="file"
          accept=".json"
          aria-label="Upload JSON file"
          onChange={handleInputChange}
          className="file-input"
        />
      </div>
      {isLoading && <p>Loading file...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default function CreatePage() {
  const [jsonData, setJsonData] = useState<unknown>(null);

  const handleDataLoaded = (data: unknown) => {
    setJsonData(data);
    console.log('JSON data loaded:', data);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white border-b">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Home
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Create Image</h1>
          <JsonUploader onDataLoaded={handleDataLoaded} />
        </div>
        
        {!!jsonData ? (
          <div className="bg-white rounded-lg border">
            <div className="p-4 pb-2">
              <TemplateEditor jsonData={jsonData} renderOnly={true} />
            </div>
            <div className="border-t p-2">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                onClick={() => {
                  // Find the SVG element in the editor
                  const editorContainer = document.querySelector('.bg-white.rounded-lg.border');
                  const editorSvg = editorContainer?.querySelector('svg') as SVGSVGElement;
                  console.log('Found editor container:', editorContainer);
                  console.log('Found SVG:', editorSvg);
                  
                  if (editorSvg) {
                    // Create a deep clone of the SVG
                    const clonedSvg = editorSvg.cloneNode(true) as SVGSVGElement;
                    
                    // Ensure the SVG has explicit dimensions
                    const width = editorSvg.width.baseVal.value;
                    const height = editorSvg.height.baseVal.value;
                    clonedSvg.setAttribute('width', String(width));
                    clonedSvg.setAttribute('height', String(height));
                    
                    // Remove any editing-specific elements
                    const resizeHandles = clonedSvg.querySelectorAll('circle, .resize-handle');
                    resizeHandles.forEach(handle => handle.remove());
                    
                    // Remove any transform styles that might affect rendering
                    clonedSvg.style.transform = '';
                    clonedSvg.style.transformOrigin = '';
                    
                    // Create a canvas element
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas dimensions
                    canvas.width = width;
                    canvas.height = height;
                    console.log('Canvas dimensions:', width, height);
                    
                    // Convert SVG to string with proper XML declaration
                    const svgData = new XMLSerializer().serializeToString(clonedSvg);
                    console.log('SVG data length:', svgData.length);
                    
                    const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
                      <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
                      ${svgData}`;
                    
                    // Create image from SVG
                    const img = new Image();
                    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                    const url = URL.createObjectURL(svgBlob);
                    
                    img.onload = () => {
                      console.log('Image loaded:', img.width, img.height);
                      if (ctx) {
                        // Fill background with white
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                        // Draw the image
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Convert to PNG and download
                        canvas.toBlob((blob) => {
                          if (blob) {
                            console.log('Blob created:', blob.size);
                            const downloadUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = 'template-image.png';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(downloadUrl);
                          } else {
                            console.error('Failed to create blob');
                          }
                        }, 'image/png');
                      }
                      URL.revokeObjectURL(url);
                    };
                    
                    img.onerror = (error) => {
                      console.error('Error loading image:', error);
                    };
                    
                    img.src = url;
                  } else {
                    console.error('SVG element not found');
                  }
                }}
              >
                <FileImage size={20} />
                Download Image
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center">
            <p className="text-gray-600">
              Upload a template file to start creating your image
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
