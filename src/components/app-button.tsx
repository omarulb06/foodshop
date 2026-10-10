import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';
type Size = 'medium' | 'large';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  /** Small line under the label, used for hints such as a pending change count. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  hint,
  style,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.medium,
        variantStyles[variant].container,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      <View>
        <Text style={[styles.label, variantStyles[variant].label]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, variantStyles[variant].label]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  large: {
    minHeight: 60,
  },
  medium: {
    minHeight: 48,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.85,
  },
});

const variantStyles: Record<Variant, { container: ViewStyle; label: { color: string } }> = {
  primary: {
    container: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    label: { color: colors.onPrimary },
  },
  secondary: {
    container: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    label: { color: colors.primary },
  },
  danger: {
    container: { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
    label: { color: colors.danger },
  },
  quiet: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    label: { color: colors.primary },
  },
};
