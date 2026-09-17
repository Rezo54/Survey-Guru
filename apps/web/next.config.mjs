/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(process.env.SURVEY_GURU_DEV_ALLOWED_ORIGIN
    ? { allowedDevOrigins: process.env.SURVEY_GURU_DEV_ALLOWED_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean) }
    : {}),
  transpilePackages: [
    '@survey-guru/domain',
    '@survey-guru/capabilities',
    '@survey-guru/api-client'
  ]
};

export default nextConfig;
