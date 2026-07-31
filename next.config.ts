import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Venue logo uploads (actions/venues.ts) accept images up to 8 MB —
      // Next's default 1 MB server-action body cap 500s anything bigger.
      // 10 MB leaves headroom for multipart overhead.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
