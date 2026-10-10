import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { copy } from '@/lib/copy';
import { colors, fontSize, radius, spacing } from '@/theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchFieldProps) {
  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
        textAlign="right"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.clearSearch}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clear, pressed ? styles.clearPressed : null]}>
          <Text style={styles.clearLabel}>{copy.clear}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 56,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyLarge,
    color: colors.text,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  clear: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  clearPressed: {
    opacity: 0.6,
  },
  clearLabel: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.primary,
  },
});
