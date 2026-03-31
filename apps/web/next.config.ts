import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@block-editor/auth", "@block-editor/authz", "@block-editor/db"],
};

export default nextConfig;
