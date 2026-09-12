import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.surveyguru.app',
  appName: 'Survey Guru',
  webDir: '../../apps/web/out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
