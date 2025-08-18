import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';

export const ImageWarpModule = requireNativeModule('ImageWarp');
export const ImageWarpNativeView = requireNativeViewManager('ImageWarp');
