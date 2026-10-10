const { withAppDelegate, withMainApplication } = require('expo/config-plugins');

/**
 * Forces Hebrew RTL before React Native draws the first frame.
 * Expo regenerates ios/ and android/ on prebuild, so this lives in a config
 * plugin rather than a hand-edited AppDelegate or MainApplication.
 *
 * iOS writes the same NSUserDefaults keys that RCTI18nUtil uses, then forces
 * UIKit's layout direction. Android calls I18nUtil directly.
 */
const IOS_MARKER = 'RCTI18nUtil_forceRTL';
const IOS_SNIPPET = `
    UserDefaults.standard.set(true, forKey: "RCTI18nUtil_allowRTL")
    UserDefaults.standard.set(true, forKey: "RCTI18nUtil_forceRTL")
    UIView.appearance().semanticContentAttribute = .forceRightToLeft`;

function withIosForceRtl(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') return mod;
    if (mod.modResults.contents.includes(IOS_MARKER)) return mod;

    const anchor = 'didFinishLaunchingWithOptions launchOptions:';
    const anchorAt = mod.modResults.contents.indexOf(anchor);
    const insertAt = anchorAt === -1 ? -1 : mod.modResults.contents.indexOf('{', anchorAt);
    if (insertAt === -1) return mod;

    let contents =
      mod.modResults.contents.slice(0, insertAt + 1) +
      IOS_SNIPPET +
      mod.modResults.contents.slice(insertAt + 1);

    if (!contents.includes('import UIKit')) {
      contents = `import UIKit\n${contents}`;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

function withAndroidForceRtl(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') return mod;

    let contents = mod.modResults.contents;
    const importLine = 'import com.facebook.react.modules.i18nmanager.I18nUtil';
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        'import android.app.Application\n',
        `import android.app.Application\n\n${importLine}\n`
      );
    }

    const call = [
      'I18nUtil.getInstance().allowRTL(this, true)',
      'I18nUtil.getInstance().forceRTL(this, true)',
    ].join('\n    ');

    if (!contents.includes('forceRTL')) {
      contents = contents.replace('super.onCreate()\n', `super.onCreate()\n    ${call}\n`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

function withForceRtl(config) {
  return withAndroidForceRtl(withIosForceRtl(config));
}

module.exports = withForceRtl;
