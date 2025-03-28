import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Configure route segment
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // This will help debug Chromium installation on Vercel
    const chromiumInfo = {
      path: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: {
        width: 1080,
        height: 1080
      }
    };
    
    let browserInfo = "Browser not launched";
    
    try {
      // Try launching the browser
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process'
        ],
        executablePath: await chromium.executablePath(),
        defaultViewport: {
          width: 1080,
          height: 1080,
          deviceScaleFactor: 2
        }
      });
      
      // Get browser version info
      const version = await browser.version();
      browserInfo = `Successfully launched: ${version}`;
      
      // Always close the browser
      await browser.close();
    } catch (browserError: Error | unknown) {
      const errorMessage = browserError instanceof Error 
        ? browserError.message 
        : String(browserError);
      browserInfo = `Failed to launch browser: ${errorMessage}`;
    }
    
    // Return diagnostic information
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      serverless: true,
      chromium: chromiumInfo,
      browser: browserInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error: Error | unknown) {
    console.error('Chrome check error:', error);
    const errorObj = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
    
    return NextResponse.json({
      ...errorObj,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 