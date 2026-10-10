import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { copy } from '@/lib/copy';
import { ensureRtl } from '@/lib/rtl';
import { StockToast } from '@/components/stock-toast';
import { InventoryProvider, useInventory } from '@/state/inventory-context';
import { colors, fontSize, spacing } from '@/theme';

ensureRtl();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.rtl}>
        <InventoryProvider>
          <AppRoutes />
          <StockToast />
        </InventoryProvider>
      </View>
    </SafeAreaProvider>
  );
}

/**
 * The stored inventory is read once before any screen mounts, so no screen has
 * to deal with a half loaded shop.
 */
function AppRoutes() {
  const { status, loadError, retryLoad } = useInventory();

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.fallback}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.fallbackText}>{copy.opening}</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.errorRoot}>
        <Screen width="form" style={styles.errorScreen}>
          <Notice
            tone="danger"
            title={copy.loadFailedTitle}
            message={loadError ?? copy.loadFailedBody}
          />
          <AppButton label={copy.tryAgain} onPress={retryLoad} />
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: fontSize.title, fontWeight: '700' },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="update-stock" options={{ title: copy.updateStock }} />
      <Stack.Screen name="add-product" options={{ title: copy.addProduct }} />
      <Stack.Screen name="product/[id]/index" options={{ title: copy.productName }} />
      <Stack.Screen name="product/[id]/edit" options={{ title: copy.editProduct }} />
      <Stack.Screen name="scan" options={{ title: copy.scanBarcode, headerShown: false }} />
      <Stack.Screen name="order/new" options={{ title: copy.newOrder }} />
      <Stack.Screen name="order/[id]" options={{ title: copy.order }} />
      <Stack.Screen name="intake/new" options={{ title: copy.newIntake }} />
      <Stack.Screen name="intake/[id]" options={{ title: copy.supplierDeliveries }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  rtl: {
    flex: 1,
    direction: 'rtl',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  fallbackText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorScreen: {
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
