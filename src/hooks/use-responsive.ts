import { useWindowDimensions } from 'react-native';

import { spacing } from '@/theme';

export interface Responsive {
  width: number;
  /** True from roughly a small Samsung tablet in portrait upwards. */
  isTablet: boolean;
  isWide: boolean;
  /** Columns for the stock grid. */
  columns: number;
  /** Keeps lists readable instead of stretching across a tablet. */
  contentMaxWidth: number;
  /** Short forms stay narrow so the eye does not travel. */
  formMaxWidth: number;
  gutter: number;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const isWide = width >= 1080;

  return {
    width,
    isTablet,
    isWide,
    columns: isWide ? 3 : isTablet ? 2 : 1,
    contentMaxWidth: isWide ? 1200 : 900,
    formMaxWidth: 640,
    gutter: isTablet ? spacing.xl : spacing.lg,
  };
}
