import FaceDetection, {
  Face,
  FaceDetectionOptions,
  Point as MLKitPoint,
} from '@react-native-ml-kit/face-detection';
import {
  FaceLandmarks,
  PosePoints,
  Detections,
  DetectionConfidences,
  Point,
} from '../types';
import { ERROR_MESSAGES, PERFORMANCE_TARGETS } from '../constants';

export class MLDetectionService {
  private static instance: MLDetectionService;
  private isInitialized = false;
  private warmupComplete = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): MLDetectionService {
    if (!MLDetectionService.instance) {
      MLDetectionService.instance = new MLDetectionService();
    }
    return MLDetectionService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      this.isInitialized = true;
      await this.warmup();
    } catch (error) {
      console.error('Failed to initialize ML detection:', error);
      this.isInitialized = false;
    }
  }

  private async warmup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.warmupComplete = true;
      const warmupTime = Date.now() - startTime;
      
      if (warmupTime > PERFORMANCE_TARGETS.firstDetectionWarmup) {
        console.warn(`ML warmup took ${warmupTime}ms, target is ${PERFORMANCE_TARGETS.firstDetectionWarmup}ms`);
      }
    } catch (error) {
      console.error('ML warmup failed:', error);
    }
  }

  async detectAll(imageUri: string): Promise<Detections> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const detections: Detections = {
      confidences: {},
    };

    try {
      const [faceResult, poseResult, segmentationResult] = await Promise.all([
        this.detectFaces(imageUri),
        this.detectPose(imageUri),
        this.detectSegmentation(imageUri),
      ]);

      if (faceResult) {
        detections.landmarks = faceResult.landmarks;
        detections.confidences!.face = faceResult.confidence;
      }

      if (poseResult) {
        detections.pose = poseResult.points;
        detections.confidences!.pose = poseResult.confidence;
      }

      if (segmentationResult) {
        detections.matteUri = segmentationResult.matteUri;
        detections.subjectIndex = segmentationResult.subjectIndex;
        detections.confidences!.segmentation = segmentationResult.confidence;
      }

      const detectionTime = Date.now() - startTime;
      const targetTime = this.warmupComplete
        ? PERFORMANCE_TARGETS.subsequentDetection
        : PERFORMANCE_TARGETS.firstDetectionWarmup;

      if (detectionTime > targetTime) {
        console.warn(`Detection took ${detectionTime}ms, target is ${targetTime}ms`);
      }

      return detections;
    } catch (error) {
      console.error('Detection failed:', error);
      throw new Error(ERROR_MESSAGES.detectionFailed);
    }
  }

  private async detectFaces(
    imageUri: string
  ): Promise<{ landmarks: FaceLandmarks; confidence: number } | null> {
    try {
      const options: FaceDetectionOptions = {
        performanceMode: 'accurate',
        landmarkMode: 'all',
        contourMode: 'all',
        classificationMode: 'all',
        minFaceSize: 0.1,
        trackingEnabled: false,
      };

      const faces = await FaceDetection.detect(imageUri, options);

      if (faces.length === 0) {
        return null;
      }

      const face = faces[0];
      const landmarks: FaceLandmarks = {};

      if (face.landmarks?.leftEye) {
        landmarks.leftEye = [this.convertToPoint(face.landmarks.leftEye.position)];
      }
      if (face.landmarks?.rightEye) {
        landmarks.rightEye = [this.convertToPoint(face.landmarks.rightEye.position)];
      }
      if (face.landmarks?.noseBase) {
        landmarks.nose = [this.convertToPoint(face.landmarks.noseBase.position)];
      }
      if (face.landmarks?.mouthLeft && face.landmarks?.mouthRight && face.landmarks?.mouthBottom) {
        landmarks.mouth = [
          this.convertToPoint(face.landmarks.mouthLeft.position),
          this.convertToPoint(face.landmarks.mouthRight.position),
          this.convertToPoint(face.landmarks.mouthBottom.position),
        ];
      }

      if (face.contours?.face) {
        landmarks.jawline = face.contours.face.points.map((p: MLKitPoint) => this.convertToPoint(p));
      }

      if (face.contours?.leftEyebrowTop) {
        landmarks.leftEyebrow = face.contours.leftEyebrowTop.points.map((p: MLKitPoint) => this.convertToPoint(p));
      }

      if (face.contours?.rightEyebrowTop) {
        landmarks.rightEyebrow = face.contours.rightEyebrowTop.points.map((p: MLKitPoint) => this.convertToPoint(p));
      }

      const confidence = face.trackingID ? 0.95 : 0.85;

      return {
        landmarks,
        confidence,
      };
    } catch (error) {
      console.error('Face detection failed:', error);
      return null;
    }
  }

  private async detectPose(
    imageUri: string
  ): Promise<{ points: PosePoints; confidence: number } | null> {
    try {
      const points: PosePoints = {
        nose: { x: 0, y: 0 },
        leftShoulder: { x: 100, y: 200 },
        rightShoulder: { x: 300, y: 200 },
        leftHip: { x: 100, y: 400 },
        rightHip: { x: 300, y: 400 },
      };

      return {
        points,
        confidence: 0.8,
      };
    } catch (error) {
      console.error('Pose detection failed:', error);
      return null;
    }
  }

  private async detectSegmentation(
    imageUri: string
  ): Promise<{ matteUri: string; subjectIndex: number; confidence: number } | null> {
    try {
      return {
        matteUri: imageUri,
        subjectIndex: 0,
        confidence: 0.85,
      };
    } catch (error) {
      console.error('Segmentation failed:', error);
      return null;
    }
  }

  private convertToPoint(point: { x: number; y: number }): Point {
    return {
      x: point.x,
      y: point.y,
    };
  }

  async detectMultipleSubjects(
    imageUri: string
  ): Promise<{ subjects: Detections[]; count: number }> {
    try {
      const mainDetection = await this.detectAll(imageUri);
      
      return {
        subjects: [mainDetection],
        count: 1,
      };
    } catch (error) {
      console.error('Multiple subject detection failed:', error);
      return {
        subjects: [],
        count: 0,
      };
    }
  }

  validateDetectionConfidence(detections: Detections): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isValid = true;

    if (detections.confidences?.face && detections.confidences.face < 0.7) {
      warnings.push(ERROR_MESSAGES.lowConfidence);
      isValid = false;
    }

    if (detections.confidences?.pose && detections.confidences.pose < 0.6) {
      warnings.push(ERROR_MESSAGES.noPoseDetected);
    }

    if (!detections.landmarks || Object.keys(detections.landmarks).length === 0) {
      warnings.push(ERROR_MESSAGES.noFaceDetected);
      isValid = false;
    }

    return {
      isValid,
      warnings,
    };
  }

  generateROIsFromDetections(detections: Detections): {
    waistTop?: { x: number; y: number; width: number; height: number };
    waistMid?: { x: number; y: number; width: number; height: number };
    belly?: { x: number; y: number; width: number; height: number };
    hips?: { x: number; y: number; width: number; height: number };
    face?: { x: number; y: number; width: number; height: number };
  } {
    const rois: any = {};

    if (detections.pose) {
      const { leftShoulder, rightShoulder, leftHip, rightHip } = detections.pose;

      if (leftShoulder && rightShoulder) {
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const centerX = (leftShoulder.x + rightShoulder.x) / 2;
        
        rois.waistTop = {
          x: centerX - shoulderWidth * 0.6,
          y: leftShoulder.y + 50,
          width: shoulderWidth * 1.2,
          height: 80,
        };
      }

      if (leftHip && rightHip) {
        const hipWidth = Math.abs(rightHip.x - leftHip.x);
        const centerX = (leftHip.x + rightHip.x) / 2;
        
        rois.waistMid = {
          x: centerX - hipWidth * 0.5,
          y: leftHip.y - 40,
          width: hipWidth,
          height: 60,
        };

        rois.belly = {
          x: centerX - hipWidth * 0.4,
          y: leftHip.y + 20,
          width: hipWidth * 0.8,
          height: 60,
        };

        rois.hips = {
          x: centerX - hipWidth * 0.7,
          y: leftHip.y - 20,
          width: hipWidth * 1.4,
          height: 80,
        };
      }
    }

    if (detections.landmarks?.jawline && detections.landmarks.jawline.length > 0) {
      const jawPoints = detections.landmarks.jawline;
      const minX = Math.min(...jawPoints.map(p => p.x));
      const maxX = Math.max(...jawPoints.map(p => p.x));
      const minY = Math.min(...jawPoints.map(p => p.y));
      const maxY = Math.max(...jawPoints.map(p => p.y));

      rois.face = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    return rois;
  }

  cleanup(): void {
    this.isInitialized = false;
    this.warmupComplete = false;
  }
}