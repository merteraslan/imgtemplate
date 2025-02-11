'use client';

import TemplateEditor from '@/components/TemplateEditor';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateTemplatePage() {
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
        <TemplateEditor />
      </main>
    </div>
  );
}
