'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen">
      <div className="p-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Home
        </Link>
      </div>
      <main className="px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Create Image</h1>
          <JsonUploader onDataLoaded={handleDataLoaded} />
          {!!jsonData && (
            <div>
              <h2>Image Preview</h2>
              <TemplateEditor jsonData={jsonData} renderOnly={true} />
            </div>
          )}
          <div className="grid gap-4">
            <p>This is the create page where you can create new images from templates.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
