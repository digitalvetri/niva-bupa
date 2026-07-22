/** @type {import('next').NextConfig} */
const nextConfig = { experimental: { serverComponentsExternalPackages: ["@prisma/client", "papaparse"] } };
export default nextConfig;
