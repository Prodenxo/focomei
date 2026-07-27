import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /** Landing pública em https://contadores.focomei.com.br/lp */
  basePath: "/lp",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/lp",
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
