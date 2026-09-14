/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: [
    '@survey-guru/domain',
    '@survey-guru/capabilities',
    '@survey-guru/api-client'
  ]
};

export default nextConfig;
