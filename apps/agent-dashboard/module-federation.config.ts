import { createModuleFederationConfig } from "@module-federation/vite";

export default createModuleFederationConfig({
  name: "agentDashboard",
  filename: "remoteEntry.js",
  exposes: {
    "./AgentApp": "./src/App.tsx",
    "./AgentDashboard": "./src/App.tsx",
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
