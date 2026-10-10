import { I18nManager } from 'react-native';

/**
 * Stores the RTL preference for native headers and the next cold start.
 * The React tree also sets `direction: 'rtl'` immediately, and the config
 * plugin applies the same force in the iOS AppDelegate and Android
 * MainApplication before the first frame of a release build.
 */
export function ensureRtl(): void {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
