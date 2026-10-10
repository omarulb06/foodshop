const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Lets release APKs be signed with your own keystore without storing anything
 * secret in this repository.
 *
 * Out of the box Expo signs release builds with the shared debug keystore that
 * ships with the Android template. That is fine for sideloading inside your own
 * shop. If you would rather use your own key, create one outside the repository
 * and put these four properties in your personal Gradle file
 * (`~/.gradle/gradle.properties` on macOS and Linux,
 * `%USERPROFILE%\.gradle\gradle.properties` on Windows):
 *
 *   FOODSHOP_STORE_FILE=/absolute/path/to/release.keystore
 *   FOODSHOP_STORE_PASSWORD=...
 *   FOODSHOP_KEY_ALIAS=...
 *   FOODSHOP_KEY_PASSWORD=...
 *
 * That file lives in your user profile, not in this project, so the passwords
 * are never committed. Keep using the same keystore for every build: Android
 * refuses to install an update that was signed with a different key.
 */

const MARKER = 'FOODSHOP_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `
        release {
            // Added by plugins/with-release-signing.js
            if (project.hasProperty('${MARKER}')) {
                storeFile file(project.property('${MARKER}'))
                storePassword project.property('FOODSHOP_STORE_PASSWORD')
                keyAlias project.property('FOODSHOP_KEY_ALIAS')
                keyPassword project.property('FOODSHOP_KEY_PASSWORD')
            } else {
                // Shared debug keystore from the Expo template. Good enough for
                // installing the app yourself, not for a Play Store release.
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
`;

function addReleaseSigningConfig(contents) {
  const anchor = contents.indexOf('signingConfigs {');
  if (anchor === -1) {
    console.warn(
      '[with-release-signing] Could not find signingConfigs in android/app/build.gradle. Release builds will keep the Expo default signing.'
    );
    return contents;
  }

  const insertAt = anchor + 'signingConfigs {'.length;
  return contents.slice(0, insertAt) + RELEASE_SIGNING_CONFIG + contents.slice(insertAt);
}

function useReleaseSigningConfig(contents) {
  // Only the release build type should switch over; debug keeps its own config.
  const pattern = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!pattern.test(contents)) {
    console.warn(
      '[with-release-signing] Could not find the release build type in android/app/build.gradle. Release builds will keep the Expo default signing.'
    );
    return contents;
  }
  return contents.replace(pattern, '$1signingConfig signingConfigs.release');
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      console.warn(
        '[with-release-signing] Unexpected build.gradle language, skipping release signing setup.'
      );
      return gradleConfig;
    }

    if (gradleConfig.modResults.contents.includes(MARKER)) {
      return gradleConfig;
    }

    let contents = addReleaseSigningConfig(gradleConfig.modResults.contents);
    if (contents.includes(MARKER)) {
      contents = useReleaseSigningConfig(contents);
    }

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
};
