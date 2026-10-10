import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useRef } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { copy } from '@/lib/copy';
import { colors, fontSize, spacing } from '@/theme';

const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
  'qr',
  'pdf417',
  'aztec',
  'datamatrix',
];

interface BarcodeScannerProps {
  /** When false, detections are ignored so a result dialog can stay open. */
  enabled: boolean;
  onScanned: (value: string) => void;
}

/**
 * Camera preview with ML Kit barcode scanning (via expo-camera, which uses
 * CameraX and Google ML Kit on Android). Only one preview may be mounted.
 */
export function BarcodeScanner({ enabled, onScanned }: BarcodeScannerProps) {
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);

  if (!permission) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.message}>{copy.cameraLoading}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const blocked = permission.canAskAgain === false;
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.message}>{blocked ? copy.cameraBlocked : copy.cameraNeeded}</Text>
        <AppButton
          label={blocked ? copy.openSettings : copy.cameraAllow}
          onPress={() => {
            if (blocked) void Linking.openSettings();
            else void requestPermission();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {focused ? (
        <CameraView
          style={styles.fill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={
            enabled
              ? (result) => {
                  if (lock.current || !result.data) return;
                  lock.current = true;
                  onScanned(result.data);
                  setTimeout(() => {
                    lock.current = false;
                  }, 1200);
                }
              : undefined
          }
        />
      ) : null}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
        <Text style={styles.hint}>{copy.scanHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000000',
  },
  messageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  message: {
    fontSize: fontSize.bodyLarge,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.text,
    writingDirection: 'rtl',
  },
  frameWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  frame: {
    width: 240,
    height: 160,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  hint: {
    color: '#FFFFFF',
    fontSize: fontSize.body,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
});
