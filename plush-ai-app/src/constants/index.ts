import { ToolConfig } from '../types';

export const TOOLS: ToolConfig[] = [
  {
    id: 'body',
    name: 'Body',
    icon: '👤',
    subTools: ['waist', 'hips']
  },
  {
    id: 'face',
    name: 'Face',
    icon: '😊'
  },
  {
    id: 'hips',
    name: 'Hips',
    icon: '⚖️'
  },
  {
    id: 'waist',
    name: 'Waist',
    icon: '📏'
  },
  {
    id: 'magnifier',
    name: 'Magnifier',
    icon: '🔍'
  },
  {
    id: 'remover',
    name: 'Remover',
    icon: '🧹'
  },
  {
    id: 'background',
    name: 'Background',
    icon: '🖼️'
  },
  {
    id: 'liquify',
    name: 'Liquify',
    icon: '💧'
  },
  {
    id: 'basics',
    name: 'Basics',
    icon: '⚙️'
  }
];

export const IMAGE_MAX_SIZE = 24 * 1024 * 1024; // 24MP
export const PREVIEW_MAX_SIZE = 3 * 1024 * 1024; // 3MP for preview
export const EXPORT_MAX_SIZE = 12 * 1024 * 1024; // 12MP for export

export const HISTORY_LIMIT = 50;
export const SESSION_STORAGE_KEY = 'plush-ai-sessions';

export const DEFAULT_BRUSH_SIZE = 50;
export const DEFAULT_BRUSH_STRENGTH = 0.5;
export const DEFAULT_BRUSH_SOFTNESS = 0.8;

export const SLIDER_RANGES = {
  eyeSize: { min: -15, max: 15, default: 0 },
  eyeSpacing: { min: -15, max: 15, default: 0 },
  noseWidth: { min: -15, max: 15, default: 0 },
  lipVolume: { min: -15, max: 15, default: 0 },
  jawSlim: { min: 0, max: 25, default: 0 },
  chinLength: { min: -15, max: 15, default: 0 },
  faceSlim: { min: 0, max: 25, default: 0 },
  skinSmooth: { min: 0, max: 100, default: 0 },
  waistTop: { min: -12, max: 12, default: 0 },
  waistMid: { min: -12, max: 12, default: 0 },
  belly: { min: -12, max: 12, default: 0 },
  hips: { min: -12, max: 12, default: 0 },
  bodySlim: { min: 0, max: 12, default: 0 },
  exposure: { min: -100, max: 100, default: 0 },
  saturation: { min: -100, max: 100, default: 0 },
  temperature: { min: -100, max: 100, default: 0 },
  tint: { min: -100, max: 100, default: 0 },
  backgroundBlur: { min: 0, max: 100, default: 50 }
};

export const PERFORMANCE_TARGETS = {
  firstDetectionWarmup: 400, // ms
  subsequentDetection: 150, // ms
  sliderResponse: 50, // ms
  exportTime12MP6Ops: 4000, // ms
  exportTime12MP12Ops: 8000, // ms
  peakMemory: 600 * 1024 * 1024, // 600MB
  minFPS: 55
};

export const ERROR_MESSAGES = {
  noFaceDetected: 'No face detected. Use manual tools instead.',
  noPoseDetected: 'No body detected. Use manual tools instead.',
  lowConfidence: 'Area not found—use manual brush instead.',
  multipleSubjects: 'Multiple people detected. Tap to select one.',
  exportTakingLong: 'This may take longer than usual...',
  inpaintAreaTooLarge: 'Selection too large. Try smaller selections.',
  imageLoadFailed: 'Failed to load image. Please try another.',
  sessionSaveFailed: 'Failed to save your work. Please try again.',
  detectionFailed: 'Detection failed. Using manual mode.'
};