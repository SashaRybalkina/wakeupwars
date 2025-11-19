/**
 * @file modules.d.ts
 * @description TypeScript module declaration for importing SVG files in React Native.
 */


declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
