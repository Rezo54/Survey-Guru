import type { CapacitorConfig } from '@capacitor/cli';

const mobileWebUrl = process.env.SURVEY_GURU_MOBILE_WEB_URL;
if (mobileWebUrl && new URL(mobileWebUrl).protocol !== 'https:') throw new Error('SURVEY_GURU_MOBILE_WEB_URL must use HTTPS.');

const config: CapacitorConfig = {
  appId: 'ai.surveyguru.app',
  appName: 'Survey Guru',
  webDir: 'www',
  android: { useLegacyBridge: true },
  server: {
    androidScheme: 'https',
    ...(mobileWebUrl ? { url: mobileWebUrl } : {}),
  }
};

export default config;
