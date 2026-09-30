import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import mfConfig from "./module-federation.config.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    federation(mfConfig),
  ],
  server: {
    port: 5173,
  },
  build: {
    target: "chrome89",
  },
});
