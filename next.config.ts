import type { NextConfig } from "next";

const repoName = "peter-project";
const isCI = process.env.GITHUB_ACTIONS === "true";
const basePath = isCI ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
