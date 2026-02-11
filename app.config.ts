import { ConfigContext, ExpoConfig } from "expo/config";

// 1. Version Management
let appVersion = "1.0.0";
try {
    appVersion = require("./package.json").version;
} catch (e) {
    console.warn("Could not read version from package.json:", e);
}

// 2. Base Configuration Constants
// You can override these via environment variables if you have multiple Expo projects/orgs
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || "5d940b44-277b-444f-a60f-0add8fd0a6ae";
const OWNER = process.env.EXPO_OWNER || "lakevie-haus";
const PROJECT_SLUG = "lakeview-haus";

// 3. Asset Paths
const IOS_ICON = "./assets/images/IOS-icon.png";
const ANDROID_ICON = "./assets/images/Android-icon.png";

// 4. Production Values
const PROD_APP_NAME = "Lakeview Haus";
const PROD_BUNDLE_IDENTIFIER = "com.lakeviewhaus.biz";
const PROD_PACKAGE_NAME = "com.lakeviewhaus.biz";
const PROD_SCHEME = "lakeviewhaus";

// 5. Dynamic Config Generator
const getDynamicAppConfig = (
    environment: "development" | "production" | "preview"
): {
    name: string;
    bundleIdentifier: string;
    packageName: string;
    scheme: string;
} => {
    if (environment === "production") {
        return {
            name: PROD_APP_NAME,
            bundleIdentifier: PROD_BUNDLE_IDENTIFIER,
            packageName: PROD_PACKAGE_NAME,
            scheme: PROD_SCHEME,
        };
    }

    if (environment === "preview") {
        return {
            name: `${PROD_APP_NAME} (Preview)`,
            bundleIdentifier: `${PROD_BUNDLE_IDENTIFIER}.preview`,
            packageName: `${PROD_PACKAGE_NAME}.preview`,
            scheme: `${PROD_SCHEME}-preview`,
        };
    }

    // Development
    return {
        name: `${PROD_APP_NAME} (Dev)`,
        bundleIdentifier: `${PROD_BUNDLE_IDENTIFIER}.dev`,
        packageName: `${PROD_PACKAGE_NAME}.dev`,
        scheme: `${PROD_SCHEME}-dev`,
    };
};

// 6. Main Config Export
export default ({ config }: ConfigContext): ExpoConfig => {
    const environment = (process.env.APP_ENV as "development" | "production" | "preview") || "development";
    console.log(`⚙️  Configuring app for environment: ${environment}`);

    const { name, bundleIdentifier, packageName, scheme } = getDynamicAppConfig(environment);

    return {
        // We are deliberately NOT speading ...config here to fully control the config from this file.

        name: name,
        slug: PROJECT_SLUG,
        version: appVersion,
        orientation: "portrait",

        // Default fallback icon (use iOS one as main if unsure, or keep original if needed)
        icon: IOS_ICON,
        scheme: scheme,
        userInterfaceStyle: "automatic",
        newArchEnabled: true,

        // === iOS ===
        ios: {
            appleTeamId: "STUF6G52TN",
            supportsTablet: true,
            bundleIdentifier: bundleIdentifier,

            icon: IOS_ICON, // ✅ Explicit iOS Icon
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
                NSFaceIDUsageDescription: "Lakeview Haus uses Face ID to sign you in quickly and securely.",
            },
        },

        // === Android ===
        android: {
            icon: ANDROID_ICON, // ✅ Explicit Android Icon (Legacy)
            adaptiveIcon: {
                foregroundImage: ANDROID_ICON, // ✅ Adaptive Foreground
                backgroundColor: "#E6F4FE",
                // Note: Check if you have a separate background image if needed
                backgroundImage: "./assets/images/android-icon-background.png",
                monochromeImage: "./assets/images/android-icon-monochrome.png"
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
            package: packageName,
            versionCode: 1,
        },

        // === Web ===
        web: {
            output: "static",
            favicon: "./assets/images/favicon.png",
            bundler: "metro"
        },

        // === Plugins ===
        plugins: [
            "expo-router",
            [
                "expo-splash-screen",
                {
                    "image": "./assets/images/splash-icon.png",
                    "imageWidth": 200,
                    "resizeMode": "contain",
                    "backgroundColor": "#ffffff",
                    "dark": {
                        "backgroundColor": "#000000"
                    }
                }
            ],
            [
                "expo-image-picker",
                {
                    "photosPermission": "The app needs access to your photos to upload product images and update your profile."
                }
            ],
            [
                "expo-camera",
                {
                    "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan QR codes."
                }
            ],
            "./withPermissionDescriptions"
        ],

        // === Experiments ===
        experiments: {
            typedRoutes: true,
            reactCompiler: true
        },

        // === Extra ===
        extra: {
            APP_ENV: environment,
            router: {},
            eas: {
                projectId: EAS_PROJECT_ID
            }
        },

        // === Owner ===


        // === Updates ===
        updates: {
            url: `https://u.expo.dev/${EAS_PROJECT_ID}`
        },

        // === Runtime Version ===
        runtimeVersion: {
            policy: "appVersion"
        }
    };
};
