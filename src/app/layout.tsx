import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ApiKeyInput from "@/components/ApiKeyInput";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Image Template Editor",
  description: "A powerful template editor for creating image templates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <ApiKeyInput />
      </body>
    </html>
  );
}
