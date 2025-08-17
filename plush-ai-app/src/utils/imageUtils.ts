import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
import { ImageInfo } from '../types';
import { IMAGE_MAX_SIZE, PREVIEW_MAX_SIZE } from '../constants';

export class ImageUtils {
  static async loadImage(uri: string): Promise<ImageInfo> {
    try {
      const dimensions = await this.getImageDimensions(uri);
      return {
        uri,
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch (error) {
      console.error('Failed to load image:', error);
      throw error;
    }
  }

  static calculateAspectRatioFit(
    srcWidth: number,
    srcHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
      width: Math.round(srcWidth * ratio),
      height: Math.round(srcHeight * ratio),
    };
  }

  static getPreviewSize(width: number, height: number): { width: number; height: number } {
    const pixels = width * height;
    
    if (pixels <= PREVIEW_MAX_SIZE) {
      return { width, height };
    }

    const scale = Math.sqrt(PREVIEW_MAX_SIZE / pixels);
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  static async createPreviewUri(
    sourceUri: string,
    width: number,
    height: number
  ): Promise<string> {
    const previewSize = this.getPreviewSize(width, height);
    const tempDir = `${FileSystem.cacheDirectory}previews/`;
    
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    }

    const previewUri = `${tempDir}preview_${Date.now()}.jpg`;
    
    return previewUri;
  }

  static fixImageOrientation(exif: any): number {
    const orientation = exif?.Orientation || 1;
    const rotationMap: { [key: number]: number } = {
      3: 180,
      6: 90,
      8: 270,
    };
    return rotationMap[orientation] || 0;
  }

  static async getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject
      );
    });
  }

  static validateImageSize(width: number, height: number): boolean {
    const pixels = width * height;
    return pixels <= IMAGE_MAX_SIZE;
  }

  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async copyToAppDirectory(sourceUri: string): Promise<string> {
    const fileName = `image_${Date.now()}.jpg`;
    const destUri = `${FileSystem.documentDirectory}images/${fileName}`;
    
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}images/`);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}images/`, { 
        intermediates: true 
      });
    }

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });

    return destUri;
  }

  static async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = `${FileSystem.cacheDirectory}previews/`;
      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  static getImageType(uri: string): 'jpeg' | 'png' | 'heic' | 'unknown' {
    const extension = uri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'heic':
      case 'heif':
        return 'heic';
      default:
        return 'unknown';
    }
  }
}