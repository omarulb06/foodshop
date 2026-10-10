import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

type Tone = 'info' | 'warning' | 'danger';

interface NoticeProps {
  title?: string;
  message: string;
  tone?: Tone;
  children?: React.ReactNode;
}

export function Notice({ title, message, tone = 'info', children }: NoticeProps) {
  return (
    <View style={[styles.container, toneStyles[tone]]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
});

const toneStyles: Record<Tone, { backgroundColor: string; borderColor: string }> = {
  info: { backgroundColor: colors.surface, borderColor: colors.border },
  warning: { backgroundColor: colors.pendingSurface, borderColor: colors.pending },
  danger: { backgroundColor: colors.dangerSurface, borderColor: colors.danger },
};
