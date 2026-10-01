import { createModuleFederationConfig } from "@module-federation/vite";

export default createModuleFederationConfig({
  name: "adminDashboard",
  filename: "remoteEntry.js",
  exposes: {
    "./AdminApp": "./src/App.tsx",
    "./AdminDashboard": "./src/App.tsx",
  },
  library: {
    type: "module",
  },
  shared: {
    react: {
      singleton: true,
      requiredVersion: "^19.2.8",
    },
    "react-dom": {
      singleton: true,
      requiredVersion: "^19.2.8",
    },
    "react-router-dom": {
      singleton: true,
    },
    zustand: {
      singleton: true,
    },
    "@tanstack/react-query": {
      singleton: true,
    },
    "@myticketsmanager/ui": {
      singleton: true,
    },
  },
  dts: false,
});
