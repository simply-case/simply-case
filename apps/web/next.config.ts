import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace package ships TypeScript source, so Next must compile it.
  transpilePackages: ["@mycasepro/shared"],
};

export default nextConfig;
