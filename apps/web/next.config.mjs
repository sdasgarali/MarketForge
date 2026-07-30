/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker runtime stage.
  output: 'standalone',
  // Trace files from the monorepo root so standalone bundling works.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
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
