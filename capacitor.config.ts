import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dz.bahtak.app',
  appName: 'بحثك',
  webDir: 'dist',
  android: {
    backgroundColor: '#09090b',
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
