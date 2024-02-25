import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.net7.churros',
  appName: 'Churros',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;
