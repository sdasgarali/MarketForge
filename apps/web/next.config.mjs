// On Vercel, use the platform's native Next.js output. The standalone bundle +
// monorepo tracing root below are ONLY for the self-hosted Docker runtime stage;
// enabling them on Vercel produces a doubled output path (…/vercel/path0/vercel/
// path0/.next) and fails the deploy.
const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker-only: emit a self-contained server bundle traced from the monorepo root.
  ...(isVercel
    ? {}
    : {
        output: 'standalone',
        outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
      }),
  // Allow remote generated-asset previews (mock uses picsum; real uses S3/CDN).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  eslint: {
    // Lint is run separately in CI; do not fail the production build on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
