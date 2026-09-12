/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@survey-guru/domain',
    '@survey-guru/capabilities',
    '@survey-guru/api-client'
  ]
};

export default nextConfig;
