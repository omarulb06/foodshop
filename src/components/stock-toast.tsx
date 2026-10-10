import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInventory } from '@/state/inventory-context';
import { colors, fontSize, radius, spacing } from '@/theme';

export function StockToast() {
  const { stockAlert, dismissStockAlert } = useInventory();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!stockAlert) return;
    const timer = setTimeout(dismissStockAlert, 4000);
    return () => clearTimeout(timer);
  }, [stockAlert, dismissStockAlert]);

  if (!stockAlert) return null;

  return (
    <Pressable
      accessibilityRole="alert"
      onPress={dismissStockAlert}
      style={[styles.toast, { top: insets.top + spacing.sm }]}>
      <Text style={styles.text}>{stockAlert}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.pendingSurface,
    borderWidth: 1,
    borderColor: colors.pending,
    borderRadius: radius.lg,
  },
  text: {
    fontSize: fontSize.body,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
});
