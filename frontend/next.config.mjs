/** @type {import('next').NextConfig} */
const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000'
const allowedDevOriginsFromEnv = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const defaultAllowedDevOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins:
    allowedDevOriginsFromEnv.length > 0
      ? allowedDevOriginsFromEnv
      : defaultAllowedDevOrigins,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
  // API 代理配置
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendInternalUrl}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
