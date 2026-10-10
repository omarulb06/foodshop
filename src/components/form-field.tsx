import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, hint, error, containerStyle, style, ...inputProps },
  ref
) {
  const numeric =
    inputProps.keyboardType === 'number-pad' ||
    inputProps.keyboardType === 'decimal-pad' ||
    inputProps.keyboardType === 'numeric';

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          numeric ? styles.numeric : styles.text,
          error ? styles.inputError : null,
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    textAlign: 'right',
  },
  text: {
    writingDirection: 'rtl',
  },
  numeric: {
    writingDirection: 'ltr',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
