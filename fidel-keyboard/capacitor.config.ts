import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erifam.fidelkeyboard',
  appName: 'Fidel Keyboard',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
