// Tell TypeScript that importing .woff2 files returns a string (the data URI)
declare module '*.woff2' {
  const value: string;
  export default value;
} 