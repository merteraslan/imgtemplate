This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## API Protection

This application includes protected API endpoints that require authentication. To set up API protection:

1. Copy `.env.example` to `.env.local` for local development
2. Generate a secure random string to use as your API key
3. Set the API key in the `.env.local` file:
   ```
   API_KEY=your_secure_random_api_key_here
   ```
4. When deploying to Vercel, add the `API_KEY` environment variable in the Vercel project settings
5. The API endpoints are protected with token-based authentication, requiring the token in the Authorization header

The app includes an API Settings button that lets you enter your API key, which will be stored in localStorage and used for all API requests.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

When deploying on Vercel, make sure to set the following environment variables:

- `API_KEY`: Your secure API key for protecting endpoints
- `SITE_URL`: The URL of your deployed application (for CORS configuration)
