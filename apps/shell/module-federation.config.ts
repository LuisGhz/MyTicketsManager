import { createModuleFederationConfig } from "@module-federation/vite";

// export default createModuleFederationConfig({
//   name: "shell",
//   remotes: {
//     agentDashboard: "agentDashboard@http://localhost:5174/remoteEntry.js",
//     type: "module",
//   },
//   shared: {
//     react: {
//       singleton: true,
//       requiredVersion: "^19.2.8",
//     },
//     "react-dom": {
//       singleton: true,
//       requiredVersion: "^19.2.8",
//     },
//   },
//   dts: false,
// });

export default createModuleFederationConfig({
  name: "shell",
  remotes: {
    agentDashboard: {
      type: "module",
      name: "agentDashboard",
      entry: "http://localhost:5174/remoteEntry.js",
    },
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