import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@widgets": path.resolve(__dirname, "./src/widgets"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@entities": path.resolve(__dirname, "./src/entities"),
      "@config": path.resolve(__dirname, "./src/config"),
      // Legacy aliases for backward compatibility during migration
      "@components": path.resolve(__dirname, "./src/shared/ui"),
      "@store": path.resolve(__dirname, "./src/shared/store"),
      "@services": path.resolve(__dirname, "./src/shared/api"),
      "@hooks": path.resolve(__dirname, "./src/shared/hooks"),
      "@types": path.resolve(__dirname, "./src/shared/types"),
      "@utils": path.resolve(__dirname, "./src/shared/lib"),
      "@styles": path.resolve(__dirname, "./src/shared/styles"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
