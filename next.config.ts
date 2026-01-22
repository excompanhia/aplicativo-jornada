import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "sw/sw.ts",
  swDest: "public/sw.js",
  // importante: para não registrar duas vezes (porque você já registra manualmente no layout)
  register: false,
});

const nextConfig: NextConfig = {
  // seu config normal fica aqui (por enquanto vazio mesmo)
};

export default withSerwist(nextConfig);
