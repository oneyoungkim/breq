import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.lawnald.breq',
  appName: 'BREQ',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
}

export default config
