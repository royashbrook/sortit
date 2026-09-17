declare const __APP_VERSION__: string
declare const __RELEASE__: {
  version: string
  source: string
  fingerprint: string
  dirty: boolean
  development: boolean
  anchor: string | null
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
interface Navigator { standalone?: boolean }
