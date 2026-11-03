/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The VESTA system prompt is read from disk at runtime.
    outputFileTracingIncludes: {
      "/api/vesta": ["./lib/vesta/system-prompt.md"],
    },
  },
};

export default nextConfig;
