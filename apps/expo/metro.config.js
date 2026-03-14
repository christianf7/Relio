// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  unstable_conditionNames: [
    "react-native",
    "import",
    "require",
    "browser",
  ],
};

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = withNativeWind(config);
