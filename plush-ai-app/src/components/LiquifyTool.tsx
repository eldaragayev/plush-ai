import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Dimensions,
  Text,
  TouchableOpacity,
  Slider,
} from 'react-native';
import {
  Canvas,
  Path,
  Paint,
  vec,
  Image as SkiaImage,
  Skia,
  RuntimeShader,
  useImage,
  Group,
  Circle,
} from '@shopify/react-native-skia';
import { Point, Stroke } from '../types';
import { DEFAULT_BRUSH_SIZE, DEFAULT_BRUSH_STRENGTH, DEFAULT_BRUSH_SOFTNESS } from '../constants';

interface LiquifyToolProps {
  imageUri: string;
  width: number;
  height: number;
  onStrokeEnd: (stroke: Stroke) => void;
  freezeMaskUri?: string;
}

const { width: screenWidth } = Dimensions.get('window');

const liquifyShader = `
uniform shader image;
uniform shader displacement;
uniform float2 resolution;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float2 disp = displacement.eval(coord).rg;
  
  // Convert displacement from [0,1] to [-1,1]
  disp = (disp - 0.5) * 2.0;
  
  // Scale displacement
  float2 newCoord = coord + disp * 50.0;
  
  // Clamp to image bounds
  newCoord = clamp(newCoord, float2(0), resolution);
  
  return image.eval(newCoord);
}
`;

export default function LiquifyTool({
  imageUri,
  width,
  height,
  onStrokeEnd,
  freezeMaskUri,
}: LiquifyToolProps) {
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [brushStrength, setBrushStrength] = useState(DEFAULT_BRUSH_STRENGTH);
  const [brushSoftness, setBrushSoftness] = useState(DEFAULT_BRUSH_SOFTNESS);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [brushPosition, setBrushPosition] = useState<Point | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const image = useImage(imageUri);
  const freezeMask = useImage(freezeMaskUri);
  const shader = RuntimeShader.Make(liquifyShader);
  
  const canvasRef = useRef(null);
  const displacementPath = useRef(Skia.Path.Make());
  const displacementPaint = useRef(Skia.Paint());

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const point = { x: locationX, y: locationY };
        
        setIsDrawing(true);
        setBrushPosition(point);
        setCurrentStroke([point]);
        
        displacementPath.current.moveTo(locationX, locationY);
      },
      
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const point = { x: locationX, y: locationY };
        
        setBrushPosition(point);
        setCurrentStroke(prev => [...prev, point]);
        
        if (currentStroke.length > 0) {
          const lastPoint = currentStroke[currentStroke.length - 1];
          
          // Create displacement based on movement direction
          const dx = locationX - lastPoint.x;
          const dy = locationY - lastPoint.y;
          
          // Add to displacement path
          displacementPath.current.lineTo(locationX, locationY);
        }
      },
      
      onPanResponderRelease: () => {
        setIsDrawing(false);
        setBrushPosition(null);
        
        if (currentStroke.length > 1) {
          const stroke: Stroke = {
            points: currentStroke,
            size: brushSize,
            strength: brushStrength,
            softness: brushSoftness,
          };
          
          onStrokeEnd(stroke);
        }
        
        setCurrentStroke([]);
        displacementPath.current.reset();
      },
    })
  ).current;

  const renderBrushCursor = () => {
    if (!brushPosition) return null;
    
    return (
      <Circle
        cx={brushPosition.x}
        cy={brushPosition.y}
        r={brushSize / 2}
        color="rgba(255, 255, 255, 0.3)"
        style="stroke"
        strokeWidth={2}
      />
    );
  };

  const renderDisplacementPath = () => {
    if (currentStroke.length < 2) return null;
    
    const path = Skia.Path.Make();
    path.moveTo(currentStroke[0].x, currentStroke[0].y);
    
    for (let i = 1; i < currentStroke.length; i++) {
      path.lineTo(currentStroke[i].x, currentStroke[i].y);
    }
    
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('rgba(128, 128, 255, 0.5)'));
    paint.setStrokeWidth(brushSize);
    paint.setStyle(1); // Stroke style
    paint.setStrokeCap(1); // Round cap
    paint.setStrokeJoin(1); // Round join
    
    return <Path path={path} paint={paint} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Canvas style={{ width, height }} ref={canvasRef}>
          {image && (
            <SkiaImage
              image={image}
              fit="contain"
              x={0}
              y={0}
              width={width}
              height={height}
            />
          )}
          
          {isDrawing && renderDisplacementPath()}
          {renderBrushCursor()}
        </Canvas>
      </View>
      
      <View style={styles.controls}>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Size: {Math.round(brushSize)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={150}
            value={brushSize}
            onValueChange={setBrushSize}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#007AFF"
          />
        </View>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Strength: {Math.round(brushStrength * 100)}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1}
            maximumValue={1}
            value={brushStrength}
            onValueChange={setBrushStrength}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#007AFF"
          />
        </View>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Softness: {Math.round(brushSoftness * 100)}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={brushSoftness}
            onValueChange={setBrushSoftness}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#007AFF"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  controls: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});