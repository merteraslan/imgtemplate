'use client';

import Link from 'next/link';
import { ArrowLeft, FileImage } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import TemplateEditor from '@/components/TemplateEditor';
import html2canvas from 'html2canvas';
import { TemplateData, ImageLayer } from '@/types/templateTypes';
import { fetchExternalImageAsDataURL } from '@/utils/imageUtils';

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
        onDataLoaded(jsonData);
      } catch {
        setError('Invalid JSON file.');
        onDataLoaded(null);
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
  const [jsonData, setJsonData] = useState<TemplateData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleDataLoaded = (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'canvasWidth' in data && typeof data.canvasWidth === 'number' && 'canvasHeight' in data && typeof data.canvasHeight === 'number' && 'layers' in data && Array.isArray(data.layers)) {
      setJsonData(data as TemplateData);
      console.log('JSON data loaded:', data);
    } else {
      console.error('Invalid JSON data structure received:', data);
      setJsonData(null);
      alert('Invalid JSON file structure. Please ensure it has canvasWidth, canvasHeight, and layers array.');
    }
  };

  useEffect(() => {
    const convertExternalImagesToDataUrls = async () => {
      if (!jsonData) return;

      let dataChanged = false;
      const updatedData = { ...jsonData };

      // Convert background image if it's external
      if (updatedData.backgroundImage && updatedData.backgroundImage.startsWith('http')) {
        try {
          console.log('Converting background image to data URL');
          updatedData.backgroundImage = await fetchExternalImageAsDataURL(updatedData.backgroundImage);
          dataChanged = true;
        } catch (error) {
          console.error('Failed to convert background image:', error);
        }
      }

      // Convert image layer sources if they are external
      if (updatedData.layers && updatedData.layers.length > 0) {
        for (let i = 0; i < updatedData.layers.length; i++) {
          const layer = updatedData.layers[i];
          if (layer.type === 'image' && (layer as ImageLayer).src && (layer as ImageLayer).src.startsWith('http')) {
            try {
              console.log(`Converting image for layer ${layer.id} to data URL`);
              const imgLayer = layer as ImageLayer;
              updatedData.layers[i] = {
                ...imgLayer,
                src: await fetchExternalImageAsDataURL(imgLayer.src)
              };
              dataChanged = true;
            } catch (error) {
              console.error(`Failed to convert image for layer ${layer.id}:`, error);
            }
          }
        }
      }

      if (dataChanged) {
        // Update the state only if URLs were actually converted
        console.log('Updated jsonData with data URLs');
        setJsonData(updatedData);
      }
    };

    convertExternalImagesToDataUrls();
  }, [jsonData]);
  // Note: This useEffect only runs once when jsonData is initially set.
  // It prepares the loaded data for reliable display and export.

  const handleDownloadImage = async () => {
    if (!editorRef.current || !jsonData) {
      console.error('Editor reference or JSON data not available.');
      alert('Cannot export image. Ensure a template is loaded.');
      return;
    }

    setIsExporting(true);

    try {
      console.log('Capturing element:', editorRef.current);
      console.log('Using dimensions:', jsonData.canvasWidth, jsonData.canvasHeight);

      const canvas = await html2canvas(editorRef.current, {
        width: jsonData.canvasWidth,
        height: jsonData.canvasHeight,
        x: 0,
        y: 0,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        imageTimeout: 15000,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const images = clonedDoc.querySelectorAll('image');
          images.forEach(img => {
            img.setAttribute('crossorigin', 'anonymous');
          });
        },
        logging: process.env.NODE_ENV === 'development',
      });

      console.log('Canvas generated by html2canvas:', canvas.width, canvas.height);

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
          console.log('Download triggered');
        } else {
          console.error('Failed to create blob from canvas');
          alert('Failed to export image. Could not create image blob.');
        }
        setIsExporting(false);
      }, 'image/png');

    } catch (error) {
      console.error('Error exporting image with html2canvas:', error);
      alert(`An error occurred while exporting the image: ${error instanceof Error ? error.message : String(error)}`);
      setIsExporting(false);
    }
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
          {!jsonData && <JsonUploader onDataLoaded={handleDataLoaded} />}
          {jsonData && (
            <button
              onClick={() => setJsonData(null)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
            >
              Load Another Template
            </button>
          )}
        </div>

        {jsonData ? (
          <div className="bg-white rounded-lg border">
            <div ref={editorRef} style={{ width: jsonData.canvasWidth, height: jsonData.canvasHeight, overflow: 'hidden', position: 'relative' }}>
              <TemplateEditor
                jsonData={jsonData}
                renderOnly={true}
                width={jsonData.canvasWidth}
                height={jsonData.canvasHeight}
              />
            </div>
            <div className="border-t p-2 flex justify-end">
              <button
                className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleDownloadImage}
                disabled={isExporting}
              >
                <FileImage size={20} />
                {isExporting ? 'Exporting...' : 'Download Image'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center">
            <p className="text-gray-600">
              Upload a template file (.json) to start creating your image.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
