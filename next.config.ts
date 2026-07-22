import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverless (Vercel) function bundle:
  // - ship the seeded template DB so it can be copied into /tmp at runtime
  // - ship the embedding stack, but only the linux-x64 ONNX binary (16 MB);
  //   the other platform binaries (~76 MB) never run in a lambda.
  //   sharp must stay: @xenova/transformers imports it for image decoding.
  outputFileTracingIncludes: {
    "/api/**": [
      "./prisma/demo.db",
      "node_modules/@xenova/transformers/**",
      "node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**",
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v3/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v3/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**",
    ],
  },
};

export default nextConfig;
