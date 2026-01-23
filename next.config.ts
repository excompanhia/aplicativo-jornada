import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "sw/sw.ts",
  swDest: "public/sw.js",

  // ✅ CRÍTICO: impede o reload automático quando o app volta online
  // (por padrão isso é true e chama location.reload() no evento "online")
  reloadOnOnline: false,

  // importante: para não registrar duas vezes (você registra manualmente)
  register: false,
});

const nextConfig: NextConfig = {
  // seu config normal fica aqui
};

export default withSerwist(nextConfig);
