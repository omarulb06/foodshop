import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import { colors } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Narrow layout for short forms, wide layout for lists and charts. */
  width?: 'content' | 'form';
  style?: StyleProp<ViewStyle>;
}

/** Centres content and caps its width so a tablet does not stretch lines of text. */
export function Screen({ children, width = 'content', style }: ScreenProps) {
  const { contentMaxWidth, formMaxWidth } = useResponsive();

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.inner,
          { maxWidth: width === 'form' ? formMaxWidth : contentMaxWidth },
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
