const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withImageWarp(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      // Ensure our Swift files exist in ios/ImageWarp
      const iosDir = path.join(cfg.modRequest.projectRoot, 'ios');
      const modDir = path.join(iosDir, 'ImageWarp');
      if (!fs.existsSync(modDir)) fs.mkdirSync(modDir);

      // Nothing else to modify — Xcode will compile any .swift inside ios/*
      // (Expo prebuild already links ExpoModulesCore)
      return cfg;
    },
  ]);
};
