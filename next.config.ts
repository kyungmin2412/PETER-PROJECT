import type { NextConfig } from "next";

// GITHUB_REPOSITORY is "owner/repo" with the exact canonical casing GitHub
// uses for the Pages URL (https://<owner>.github.io/<repo>/). Deriving it
// here instead of hardcoding avoids a basePath/URL casing mismatch, which
// silently 404s every asset (CSS/JS) while the raw HTML still loads.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "peter-project";
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
