import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

const config = appJson.expo as ExpoConfig;

const projectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId;

export default {
  ...config,
  extra: {
    ...config.extra,
    ...(projectId
      ? {
          eas: {
            ...config.extra?.eas,
            projectId,
          },
        }
      : {}),
  },
};
