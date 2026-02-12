module.exports = () => ({
  name: "Momentum",
  slug: "momentum",
  version: "1.0.3",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "momentum",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0a0a14",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.austinwolff.momentum",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0a0a14",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.austinwolff.momentum",
    permissions: ["android.permission.RECORD_AUDIO"],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app needs access to your photos to set a profile picture.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    // Only set baseUrl for web builds (GitHub Pages at /momentum/)
    // Setting it globally causes ENOTDIR errors on iOS asset bundling
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
  extra: {
    router: {},
    eas: {
      projectId: "09cb8c15-cf02-424c-898b-1fc6a04d922c",
    },
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/09cb8c15-cf02-424c-898b-1fc6a04d922c",
  },
});
