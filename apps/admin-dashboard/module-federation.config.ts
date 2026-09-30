import { createModuleFederationConfig } from "@module-federation/vite";

export default createModuleFederationConfig({
  name: "adminDashboard",
  filename: "remoteEntry.js",
  exposes: {
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
  },
  dts: false,
});
