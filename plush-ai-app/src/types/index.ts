export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  points: Point[];
  size: number;
  strength: number;
  softness: number;
};

export type DetectionConfidences = {
  face?: number;
  pose?: number;
  segmentation?: number;
};

export type FaceLandmarks = {
  leftEye?: Point[];
  rightEye?: Point[];
  nose?: Point[];
  mouth?: Point[];
  jawline?: Point[];
  leftEyebrow?: Point[];
  rightEyebrow?: Point[];
};

export type PosePoints = {
  nose?: Point;
  leftEye?: Point;
  rightEye?: Point;
  leftEar?: Point;
  rightEar?: Point;
  leftShoulder?: Point;
  rightShoulder?: Point;
  leftElbow?: Point;
  rightElbow?: Point;
  leftWrist?: Point;
  rightWrist?: Point;
  leftHip?: Point;
  rightHip?: Point;
  leftKnee?: Point;
  rightKnee?: Point;
  leftAnkle?: Point;
  rightAnkle?: Point;
};

export type Detections = {
  landmarks?: FaceLandmarks;
  pose?: PosePoints;
  matteUri?: string;
  subjectIndex?: number;
  confidences?: DetectionConfidences;
};

export type BodyParamKey = 
  | 'waistTop' 
  | 'waistMid' 
  | 'belly' 
  | 'hips' 
  | 'bodySlim';

export type FaceParamKey = 
  | 'eyeSize' 
  | 'eyeSpacing' 
  | 'noseWidth' 
  | 'lipVolume' 
  | 'jawSlim' 
  | 'chinLength' 
  | 'faceSlim' 
  | 'skinSmooth';

export type TransformKind = 
  | 'crop' 
  | 'rotate' 
  | 'flipH' 
  | 'flipV';

export type BackgroundMode = 
  | 'remove' 
  | 'blur' 
  | 'replace';

export type Operation =
  | { 
      type: 'liquify'; 
      strokes: Stroke[]; 
      freezeMaskUri?: string;
    }
  | { 
      type: 'magnifier'; 
      center: Point; 
      radius: number; 
      scale: number;
    }
  | { 
      type: 'twirl'; 
      center: Point; 
      radius: number; 
      angle: number;
    }
  | { 
      type: 'bodyParam'; 
      key: BodyParamKey; 
      value: number;
    }
  | { 
      type: 'faceParam'; 
      key: FaceParamKey; 
      value: number;
    }
  | { 
      type: 'inpaint'; 
      polygon: Point[];
    }
  | { 
      type: 'background'; 
      mode: BackgroundMode; 
      amount?: number; 
      replaceUri?: string;
    }
  | { 
      type: 'transform'; 
      kind: TransformKind; 
      params?: any;
    }
  | { 
      type: 'color'; 
      exposure?: number; 
      saturation?: number; 
      temperature?: number; 
      tint?: number;
    };

export type EditSession = {
  id: string;
  sourceUri: string;
  width: number;
  height: number;
  detections?: Detections;
  ops: Operation[];
  previewUri?: string;
  createdAt: number;
  updatedAt: number;
};

export type Tool = 
  | 'body'
  | 'face'
  | 'hips'
  | 'waist'
  | 'magnifier'
  | 'remover'
  | 'background'
  | 'liquify'
  | 'basics';

export type ToolConfig = {
  id: Tool;
  name: string;
  icon: string;
  subTools?: Tool[];
};

export type AppState = {
  currentSession?: EditSession;
  sessions: EditSession[];
  currentTool?: Tool;
  isProcessing: boolean;
  error?: string;
};

export type ImageInfo = {
  uri: string;
  width: number;
  height: number;
  exif?: any;
};

export type ExportOptions = {
  format: 'jpeg' | 'png';
  quality?: number;
  includeAlpha?: boolean;
};