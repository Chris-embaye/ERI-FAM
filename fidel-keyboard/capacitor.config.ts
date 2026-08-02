import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.embayechris.fidelkeyboard2',
  appName: 'Fidel Keyboard',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
