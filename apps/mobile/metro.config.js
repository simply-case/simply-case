const { getDefaultConfig } = require("expo/metro-config");

// SDK 52+ auto-detects the npm-workspaces monorepo (root node_modules,
// packages/*) — no manual watchFolders / nodeModulesPaths needed, unlike
// earlier SDKs. See docs/PLAN.md, which was written before this was
// confirmed against the current Expo docs.
const config = getDefaultConfig(__dirname);

module.exports = config;
