import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from './platform';
import { logger } from './logger';

export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    // Follow the system appearance; the web UI has light and dark themes.
    await StatusBar.setStyle({ style: Style.Default });
    await SplashScreen.hide();
    logger.info('Native shell initialized');
  } catch (err) {
    logger.logError('Native shell init failed', err);
  }
}
