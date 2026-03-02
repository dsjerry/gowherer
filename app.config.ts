import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const projectId =
    process.env.EAS_PROJECT_ID ??
    '82904fd8-1c6c-4a9f-bae4-b3c2446c9ac9';
  const appVersion = process.env.APP_VERSION ?? '1.0.0';

  return {
    name: 'gowherer',
    slug: 'gowherer',
    version: appVersion,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'gowherer',
    userInterfaceStyle: 'automatic',

    ios: {
      bundleIdentifier: 'com.dsjerry.gowherer',
      supportsTablet: true,
    },

    android: {
      package: 'com.dsjerry.gowherer',
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage:
          './assets/images/android-icon-foreground.png',
        backgroundImage:
          './assets/images/android-icon-background.png',
        monochromeImage:
          './assets/images/android-icon-monochrome.png',
      },
    },

    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-font',
      'expo-image',
      'expo-web-browser',
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission:
            '允许访问相册以将照片和视频添加到旅程时间线。',
          cameraPermission:
            '允许使用相机以拍照或拍视频记录旅程。',
          microphonePermission:
            '允许使用麦克风以录制带声音的视频。',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            '允许使用定位以记录旅程中的位置节点。',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      eas: {
        projectId,
      },
      geocoding: {
        provider:
          process.env.EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER ?? 'amap',
        amapWebKey: process.env.EXPO_PUBLIC_AMAP_WEB_KEY
      },
    },
  };
};
