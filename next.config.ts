import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the seeded template DB with the serverless functions so it can be
  // copied into /tmp at runtime (Vercel's FS is read-only outside /tmp).
  outputFileTracingIncludes: {
    "/api/**": ["./prisma/demo.db"],
  },
  // On serverless we run with EMBEDDINGS_DISABLED=1 and never load the ONNX
  // model, so keep the heavy native deps out of the function bundle.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@xenova/**",
      "node_modules/onnxruntime-node/**",
      "node_modules/sharp/**",
    ],
  },
};

export default nextConfig;
