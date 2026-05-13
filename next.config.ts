import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./prisma/demo.db'],
  },
};

export default nextConfig;
