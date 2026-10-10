#!/usr/bin/env node
// Runs the Android Gradle wrapper to produce an installable release APK and
// prints where it ended up. Called by `npm run android:apk`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const androidDir = path.join(projectRoot, 'android');

if (!existsSync(androidDir)) {
  console.error(
    'The android folder is missing. Run "npm run android:prebuild" first, then try again.'
  );
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const wrapper = isWindows ? 'gradlew.bat' : './gradlew';

console.log('Building a release APK with Gradle. The first build takes several minutes.\n');

const result = spawnSync(wrapper, ['assembleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
});

if (result.error) {
  console.error(`Could not start Gradle: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

if (existsSync(apkPath)) {
  console.log(`\nAPK ready: ${apkPath}`);
  console.log('Copy this file to your Samsung device and open it to install the app.');
} else {
  console.log('\nGradle finished, but the expected APK was not found at:');
  console.log(apkPath);
  console.log('Look under android/app/build/outputs/apk/ for the generated file.');
}
