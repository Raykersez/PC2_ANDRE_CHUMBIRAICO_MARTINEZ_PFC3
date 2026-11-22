const backend = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:3001');

const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend.origin}/api/:path*` }];
  },
};

export default nextConfig;
