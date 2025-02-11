import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="container mx-auto">
        <h1 className="text-4xl font-bold mb-8">Image Template App</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/create-template" 
            className="p-6 border rounded-lg hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">Create Template</h2>
            <p>Design and create new image templates with our template editor.</p>
          </Link>
          
          <Link href="/create"
            className="p-6 border rounded-lg hover:border-blue-500 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">Create Image</h2>
            <p>Create new images using your saved templates.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
