/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend proxying is handled by app/api/backend/[...path]/route.ts.
  // The built-in rewrites() proxy imposes a ~30-second timeout that was
  // incorrectly 500'ing legitimate slow /search responses.
};

export default nextConfig;
