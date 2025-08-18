import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { findNodeHandle, ViewProps } from 'react-native';
import { ImageWarpModule, ImageWarpNativeView } from './index';

type Props = ViewProps & {
  source: string;                 // file:// path
  center: [number, number];       // view coords (px)
  radius: number;                 // px
  scale: number;                  // -1..+1
  mode?: 'pinch' | 'bump';
};

export type ImageWarpRef = { saveAsync: () => Promise<string> };

export const ImageWarpView = forwardRef<ImageWarpRef, Props>((props, ref) => {
  const r = useRef(null);
  useImperativeHandle(ref, () => ({
    async saveAsync() {
      const tag = findNodeHandle(r.current);
      // @ts-ignore
      return await ImageWarpModule.saveAsync(tag);
    }
  }));
  return <ImageWarpNativeView ref={r} {...props} />;
});
