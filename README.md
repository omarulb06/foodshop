# Food Shop Inventory

A mobile app for the stock and orders of a food shop. The same codebase builds for iOS and Android.
The screens are in Hebrew and laid out right to left. Products, orders, and supplier deliveries are
stored in Cloud Firestore, with a copy on the phone so scanning and stock edits still work without a
connection. Approving a customer delivery deducts stock, and confirming a supplier shipment adds
stock, each in one Firestore transaction that needs the network.

Built with Expo (SDK 57), React Native and TypeScript, using Expo Router for navigation.

---

## What the app does

**Stock** — a searchable list of every product in alphabetical order, each showing its name, current
quantity and unit. Two large buttons lead to **Add product** and **Update stock**. Tapping a product
opens its details.

**Update stock** — one editing session can change as many products as you like. For each product you
choose **Add**, **Remove** or **Set exact**, type a quantity and optionally add a note. Products with
unsaved edits are highlighted, marked "Unsaved" and show the resulting quantity. A bar at the bottom
of the screen counts the pending changes. At the end of the list a summary lists every pending change,
asks who is saving (prefilled with the last name used) and offers **Save all changes**. Quantities and
their history records are written together in a single storage write, so a failed save changes nothing
and leaves your pending edits on screen to retry. Leaving the screen with unsaved edits asks for
confirmation first.

**History** — every saved change, newest first, with the quantity before and after, the amount
changed, the date and time, the optional note and the name of the person who saved it. Changes that
were saved by one press of **Save all changes** are shown together as one group. Chips at the top
filter the list down to a single product.

**Charts** — a bar chart of how many records were saved on each of the last 7 days, plus stock totals
grouped per unit. Each product's detail screen adds a 30-day line chart of its stock level. All charts
are built from the saved history, and quantities are never added across different units.

**Products** — add a product with a name, a unit (pieces, packs, boxes, bottles, kilograms or your own
unit) and a starting quantity. Quantities must be zero or more; kilograms and custom units accept
decimals, while pieces, packs, boxes and bottles are whole numbers. Creating a product is recorded in
History under the name of the person who added it. Names and units can be edited later. Deleting a
product asks for confirmation and explains that its history is deleted with it.

**Scan** — point the camera at a barcode or QR code. A short vibration confirms the read. If that
code is already a product, you can set the quantity or add the product to the current draft order.
If it is new, the app opens the add-product form with that code as the product id.

**Orders** — build a draft (טיוטה) from the stock list. A draft does not change quantities. **אישור
אספקה ללקוח** marks the order delivered and subtracts the ordered amounts from stock together, so a
failure leaves both the order and the stock unchanged.

There are still no accounts. Prices exist only on order lines. There are no expiry dates or
notifications.

---

## 1. Install the development tools

You need these on your computer (not on the phone). Commands below are for Windows PowerShell; on
macOS or Linux use your usual package manager.

### Node.js 20 or newer

Download the LTS installer from [nodejs.org](https://nodejs.org/) and install it, or:

```powershell
winget install OpenJS.NodeJS.LTS
```

Check it:

```powershell
node --version
npm --version
```

### Project dependencies

> **Work from a short path on a local disk, not a network drive.** Two separate Windows limits bite
> here, and the recommended location `C:\foodshop` satisfies both.
>
> *Network drives are far too slow.* This project's master copy sits on the mapped share `Z:`. React
> Native installs and builds write tens of thousands of small files, which a share handles very
> badly: `npm install` ran for more than 25 minutes on `Z:` and then failed, while the same install
> finishes in under a minute on a local disk.
>
> *The folder path must be short.* The Android C++ build tool `ninja` refuses any file path longer
> than 260 characters, and it mirrors your project's full path inside its generated object-file
> names. Those names are already about 234 characters before your folder path is added, so **the
> project folder must be at most 26 characters long**. `C:\Projects\food-shop-inventory` is 31
> characters and fails the APK build after roughly 20 minutes with
> `ninja: error: ... Filename longer than 260 characters`. `C:\foodshop` is 11 characters and leaves
> a comfortable margin. This limit only affects building an APK (steps 3–5), not `npm start`.
>
> Keep the copy on the share as your backup if you like.

From the folder that contains this README:

```powershell
npm install
```

That is everything you need for step 2. Steps 3 to 5 (building an APK) additionally need the Android
build tools below.

### JDK 17

```powershell
winget install Microsoft.OpenJDK.17
```

### The Android SDK

You do **not** need the Android Studio IDE. Installing Android Studio only installs the editor; the
SDK itself is a separate download. These commands fetch just the SDK, which is all Gradle needs:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools" | Out-Null
curl.exe -L -o "$env:TEMP\cmdline-tools.zip" `
  "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
Expand-Archive "$env:TEMP\cmdline-tools.zip" "$sdk\cmdline-tools\_tmp" -Force
Move-Item "$sdk\cmdline-tools\_tmp\cmdline-tools" "$sdk\cmdline-tools\latest"
Remove-Item "$sdk\cmdline-tools\_tmp","$env:TEMP\cmdline-tools.zip" -Recurse -Force
```

Then accept Google's SDK licences and install the three packages this project needs. Each licence
prompt wants its own `y`, so feed it a file of them:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
Set-Content "$env:TEMP\yes.txt" (1..200 | ForEach-Object { "y" }) -Encoding ascii
$sm = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
cmd /c "type `"$env:TEMP\yes.txt`" | `"$sm`" --licenses --sdk_root=`"$sdk`""
cmd /c "type `"$env:TEMP\yes.txt`" | `"$sm`" --sdk_root=`"$sdk`" platform-tools platforms;android-36 build-tools;36.0.0"
```

Gradle downloads the matching NDK and CMake by itself on the first build. Finally make the SDK
permanent for your account and open a **new** terminal afterwards:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("Path",
  [Environment]::GetEnvironmentVariable("Path","User") + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
```

```powershell
adb --version
```

> A terminal that was already open when you installed Node, the JDK or the SDK will not see them.
> Windows only gives the updated environment to programs started afterwards, so `npm` or `adb` will
> report "not recognized" in that old window. Open a new terminal.

### Prepare your Samsung device

1. Settings → About phone → Software information, then tap **Build number** seven times to unlock
   **Developer options**.
2. Settings → Developer options → turn on **USB debugging**.
3. Connect the device by USB and accept the "Allow USB debugging" prompt on the screen.
4. Confirm the computer can see it:

   ```powershell
   adb devices
   ```

---

## 2. Run the app during development on your Samsung device

The quickest way, without installing Android Studio, is Expo Go:

1. Install **Expo Go** from the Play Store on your Samsung phone or tablet.
2. On your computer, in this folder:

   ```powershell
   npm start
   ```

3. Make sure the computer and the device are on the same Wi-Fi network, then scan the QR code shown
   in the terminal with the Expo Go app.

The libraries this app uses are included in Expo Go, so development does not need a custom build.
Barcode scanning and cloud sync both work there once `.env` is filled in. The installable APK still
needs a fresh prebuild because the camera is a native module.
Edits to the code reload on the device within a second or two.

If you prefer to run the app as a real installed app over USB (this needs the Android tools from
step 1):

```powershell
npm run android
```

> Data saved in Expo Go is separate from data saved by the installed APK. They are two different
> Android apps as far as the system is concerned. Treat Expo Go as a scratch pad.

The same JavaScript runs on iOS. `npm start` on a Mac can open the iOS Simulator from the terminal
menu. Building or installing on an iPhone is covered in the iOS section below. There is no browser
target.

---

## 3. Build an installable APK from the source code

```powershell
npm run android:prebuild
npm run android:apk
```

- `android:prebuild` generates the native `android` folder from `app.json`. This folder is
  regenerated output, not source, so it is deliberately not committed to the repository.
- `android:apk` runs Gradle and prints the path of the finished file. The first build downloads
  Gradle and the Android build tools and can take five to fifteen minutes; later builds take about a
  minute.

The APK ends up at:

```
android/app/build/outputs/apk/release/app-release.apk
```

This is a **release** build, which means your JavaScript is compiled into the APK. The app opens and
works with no development server running, no computer nearby and no internet connection.

If you have your Samsung device plugged in over USB, this one command builds the same release app and
installs it directly:

```powershell
npm run android:release
```

---

## 4. Copy the APK to your Samsung phone or tablet and install it

Pick whichever is easiest.

**Over USB with adb** (device connected, USB debugging on):

```powershell
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`-r` replaces an already installed copy and keeps its data.

**By copying the file:**

1. Copy `app-release.apk` to the device, for example into the `Download` folder over USB, or send it
   to yourself through Google Drive, email or a USB stick.
2. On the device, open **My Files** → **Downloads** and tap the APK.
3. Android asks for permission to install apps from this source. Follow the prompt to allow it for
   the app you are installing from (My Files, Chrome, Drive, whichever you used), then tap
   **Install**.
4. The app appears in the app drawer as **Food Shop Inventory**.

Samsung devices may also show a Play Protect warning such as "Unsafe app blocked" because the app did
not come from the Play Store. Choose **Install anyway**. This is expected for an app you built
yourself.

---

## 5. Build an updated APK after changing the code

```powershell
npm install            # only if dependencies changed
npm run android:apk    # rebuilds the APK
```

Then install it over the old one using either method in step 4.

You only need `npm run android:prebuild` again if you changed `app.json`, added a library with native
code, or edited the config plugin in `plugins/`. When you do, use a clean regeneration:

```powershell
npx expo prebuild --platform android --clean
```

It is good practice to raise `android.versionCode` (and usually `version`) in `app.json` for each APK
you hand out, so you can tell builds apart. Android refuses to install an APK whose `versionCode` is
*lower* than the installed one.

---

## Does installing an updated APK keep my inventory data?

**Yes, as long as you install the new APK over the old one instead of uninstalling first.** Android
keeps an app's private storage across updates.

All of these must stay true, and they all hold automatically if you keep building from this
repository:

| Condition | Where it comes from |
| --- | --- |
| Same application ID | `android.package` in `app.json`, currently `com.foodshop.inventory` |
| Signed with the same key | See "Signing" below |
| `versionCode` not lower than the installed one | `android.versionCode` in `app.json` |
| The app is not uninstalled in between | Use "install over" or `adb install -r` |

Your data **is** erased if you uninstall the app, use Settings → Apps → Food Shop Inventory →
Storage → **Clear data**, change `android.package`, or sign a later APK with a different key. Because
the app stores everything only on the device and has no backup server, keep this in mind before you
uninstall.

---

## Signing, and why there are no secrets in this repository

Expo's Android template signs release builds with the shared debug keystore that ships with it. That
keystore contains no secret of yours, which is why nothing sensitive is committed here, and it is
perfectly adequate for installing the app on your own devices. It is not suitable for a Play Store
release, which you are not doing.

If you would rather sign with a key only you hold, create one **outside** this repository:

```powershell
keytool -genkey -v -keystore $env:USERPROFILE\food-shop-release.keystore -alias foodshop -keyalg RSA -keysize 2048 -validity 10000
```

Then add four properties to your personal Gradle file, `%USERPROFILE%\.gradle\gradle.properties`
(`~/.gradle/gradle.properties` on macOS and Linux). That file lives in your user profile, never in
this project:

```properties
FOODSHOP_STORE_FILE=C:\\Users\\you\\food-shop-release.keystore
FOODSHOP_STORE_PASSWORD=the password you chose
FOODSHOP_KEY_ALIAS=foodshop
FOODSHOP_KEY_PASSWORD=the key password you chose
```

`plugins/with-release-signing.js` wires these into the generated Gradle build when they are present
and falls back to the default keystore when they are not. Back up the keystore file and its
passwords: without them you cannot build an update that installs over an existing copy.

Decide this **before** your first install. Switching keys later means uninstalling the app, which
deletes the stored inventory.

---

## Firebase

Create a Firebase project, add a **Web** app, and copy the config into a `.env` file (see
`.env.example`). Publish `firestore.rules` in the Firebase console before using the app. Those rules
currently allow open read and write, because the app has no login. Tighten them before anyone else
can reach the project.

Without a `.env` file the app still stores everything on the phone and shows a banner explaining
that cloud sync is off. The first launch no longer inserts example products, so an empty cloud
project is not filled with sample stock.

Scanning uses `expo-camera` on both platforms. On Android that is CameraX plus Google ML Kit. On
iOS it is AVFoundation, with the extra barcode formats linked by CocoaPods when the native project
is generated. Haptics use `expo-haptics`. Firestore is the JavaScript SDK, so iOS and Android share
one database, the same security rules, and the same offline SQLite copy. No `GoogleService-Info.plist`
is required.

The Firebase keys in `.env` are inlined into whichever binary you build locally. A cloud iOS build
does not receive the gitignored `.env` file. Before the first `npm run ios:ipa` or
`npm run ios:simulator`, create an Expo account and push the same keys once:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:set --name EXPO_PUBLIC_FIREBASE_API_KEY --value "your-api-key" --environment production --visibility sensitive
```

Repeat `env:set` for `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`,
`EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and
`EXPO_PUBLIC_FIREBASE_APP_ID`. The `production` environment in `eas.json` is what the iOS profiles
read. Visibility `sensitive` is enough; do not use `secret`, because secret values are not embedded
in the app.

The native projects are generated by Expo, so camera dependencies are added at prebuild time. After
pulling these changes, regenerate Android once:

```powershell
npx expo prebuild --platform android --clean
npm run android:apk
```

## iOS

iOS builds need a Mac with Xcode, or an Expo cloud build. This Windows machine can start the cloud
build. It cannot open the iOS Simulator locally.

Camera permission text is Hebrew in both `Info.plist` and the Hebrew `InfoPlist.strings` file:

`האפליקציה זקוקה לגישה למצלמה כדי לסרוק ברקודים של מוצרים.`

Right-to-left layout is forced in JavaScript (`I18nManager.allowRTL` / `forceRTL`) and again in the
generated `AppDelegate.swift` before the first frame. CocoaPods are not written by hand. `npm run ios`
and `npm run ios:prebuild` generate `ios/Podfile` from the Expo template and run `pod install`, which
links `expo-camera`, `expo-haptics`, `expo-sqlite`, and the barcode pod.

### Simulator on a Mac

Install Xcode from the App Store, open it once, and accept the license. Then, in this folder:

```bash
npm install
npm run ios
```

That generates the Xcode project, installs pods, builds, and launches the iOS Simulator. The `.env`
file in this folder is bundled automatically. A physical iPhone connected to that Mac can be used
with:

```bash
npx expo run:ios --device
```

The first time, the iPhone must trust the computer and the signing team selected in Xcode.

### Simulator from Windows, through EAS

```powershell
npm run ios:simulator
```

When the build finishes, Expo prints a link to a simulator archive. On a Mac, download it and drag
the `.app` onto a running Simulator, or install it with `xcrun simctl install booted path/to/App.app`.

### Release IPA for a physical iPhone

```powershell
npm run ios:ipa
```

EAS asks for an Apple Developer account the first time and signs the app. The result is an `.ipa`.
Install it with Apple Configurator, TestFlight, or `npx eas-cli@latest submit --platform ios` after
the build. The bundle id is `com.foodshop.inventory`, matching the Android package. An installed
iPhone copy keeps its on-device database across updates with that same bundle id.

`ios/` is generated and gitignored, the same way `android/` is. Do not edit the Podfile or
`Info.plist` by hand. Change `app.json`, `languages/he.json`, or `plugins/`, then run
`npm run ios:prebuild` again on a Mac.

## Where the data is stored

Firestore collections:

| Collection | Contents |
| --- | --- |
| `products` | `id` (SKU or barcode), `name`, `quantity`, `lastUpdated`, plus the unit fields the shop already used |
| `orders` | `orderId`, `customerName`, `items` (`productId`, `productName`, `quantity`, `price`), `status` (`DRAFT` or `APPROVED_DELIVERED`), `createdAt`, `deliveredAt` |
| `history` | The stock-change log behind History and Charts |
| `meta/settings` | The last name used when saving a count |

A SQLite copy on the device is what the screens read. Edits are written there first and queued until
Firestore accepts them. Delivery is not queued: it needs a live transaction.

The on-device file is still:

```
/data/data/com.foodshop.inventory/files/SQLite/food-shop-inventory.db
```

That folder is readable only by this app, needs no storage permission, and is removed when the app
is uninstalled. Products, orders, history and the upload queue are stored together as one JSON
document under the key `food-shop-inventory/v1`. Writing one document in one operation is what makes
each local save all-or-nothing.

A new install starts empty. An install that already has stock keeps it, and uploads it the first
time it reaches an empty Firestore project.

---

## Project layout

```
src/app/                  Screens. Expo Router turns every file here into a route.
  _layout.tsx             Loads the stored inventory, then the navigation stack
  (tabs)/                 Stock, Orders, History and Charts tabs
  update-stock.tsx        Batch editing and saving
  add-product.tsx         New product form
  scan.tsx                Barcode and QR scanner
  order/                  Draft orders and delivery approval
  product/[id]/           Product details and the edit form
src/components/           Buttons, fields, cards, tab icons and the two hand-drawn charts
src/lib/                  Pure logic: quantities, dates, chart maths, storage
src/state/                The single inventory provider every screen reads from
plugins/                  Config plugins for RTL, Hebrew resources, and Android release signing
languages/he.json         Hebrew camera-permission text written into the iOS app
eas.json                  Cloud iOS simulator and IPA build profiles
scripts/build-apk.mjs     Wrapper around Gradle used by npm run android:apk
app.json                  App name, bundle id, version, plugins
app.config.js             Copies the Firebase `.env` keys into the iOS and Android bundle
eslint.config.js          Lint rules, extending eslint-config-expo
```

The charts and the tab icons are drawn with `react-native-svg` rather than a chart library or an
icon font, so the app carries no extra assets and the drawing code is plain to read.

`src/lib` holds no React code, which is why it is the part covered by unit tests.

### Why `package.json` excludes react-native-gesture-handler

`expo-router` lists `react-native-gesture-handler` as an *optional* peer dependency, and npm installs
optional peers automatically, so it lands in `node_modules` even though this app never imports it —
only Expo Router's JavaScript stack navigator uses it, and this app uses the native `Stack` and
`Tabs`. Its generated C++ file paths are the longest in the project and overflow ninja's 260-character
limit no matter how short the project folder is, which fails the APK build. So it is excluded from the
Android native build:

```json
"expo": { "autolinking": { "android": { "exclude": ["react-native-gesture-handler"] } } }
```

This also keeps it out of the APK. If you ever add a drawer navigator or switch to
`expo-router/js-stack`, remove that exclusion — and expect the path-length problem to return.

---

## Checks

```powershell
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Unit tests for quantities, dates, charts and storage
npx expo-doctor      # Dependency and config sanity check
```

To confirm the app still builds into a self-contained bundle, without waiting for a full Gradle
build, run a production export:

```powershell
npx expo export --platform android --output-dir .export-check
```

If that succeeds, the JavaScript that goes inside the APK compiles and the app will open without a
development server. Delete the `.export-check` folder afterwards; it is only a check.
