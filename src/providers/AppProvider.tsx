/**
 * @file AppProvider.tsx
 * @description Wraps the app with FontProvider and ThemeProvider contexts.
 */

import type { ReactNode } from 'react';

import { FontProvider } from './FontProvider';
import { ThemeProvider } from './ThemeProvider';

type Props = {
  onInitialized: () => void;
  children: ReactNode;
};

export function AppProvider(props: Props) {
  const { onInitialized, children } = props;
  return (
    <FontProvider onInitialized={onInitialized}>
      <ThemeProvider>{children}</ThemeProvider>
    </FontProvider>
  );
}
