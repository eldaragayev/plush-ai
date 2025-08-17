import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Text,
  Slider,
  SegmentedControlIOS,
  Dimensions,
} from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Circle,
  RuntimeShader,
  useImage,
  Skia,
  Group,
  Paint,
} from '@shopify/react-native-skia';
import { Point } from '../types';

interface MagnifierToolProps {
  imageUri: string;
  width: number;
  height: number;
  onApply: (center: Point, radius: number, scale: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');

const magnifierShader = `
uniform shader image;
uniform float2 center;
uniform float radius;
uniform float scale;
uniform float2 resolution;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  float2 centerUV = center / resolution;
  
  // Calculate distance from center
  float2 delta = uv - centerUV;
  float dist = length(delta * resolution);
  
  if (dist < radius) {
    // Calculate the magnification factor based on distance
    float factor = smoothstep(radius, 0.0, dist);
    
    // Apply scaling (positive for bloat, negative for pucker)
    float2 offset = delta * factor * scale;
    float2 newUV = uv - offset;
    
    // Clamp to image bounds
    newUV = clamp(newUV, float2(0), float2(1));
    
    return image.eval(newUV * resolution);
  }
  
  return image.eval(coord);
}
`;

export default function MagnifierTool({
  imageUri,
  width,
  height,
  onApply,
}: MagnifierToolProps) {
  const [mode, setMode] = useState<'bloat' | 'pucker'>('bloat');
  const [radius, setRadius] = useState(80);
  const [intensity, setIntensity] = useState(0.3);
  const [touchPoint, setTouchPoint] = useState<Point | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  
  const image = useImage(imageUri);
  const shader = RuntimeShader.Make(magnifierShader);

  const handleTouch = useCallback((event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const point = { x: locationX, y: locationY };
    
    setTouchPoint(point);
    setIsPreview(true);
  }, []);

  const handleRelease = useCallback(() => {
    if (touchPoint) {
      const scale = mode === 'bloat' ? intensity : -intensity;
      onApply(touchPoint, radius, scale);
    }
    
    setIsPreview(false);
    setTouchPoint(null);
  }, [touchPoint, radius, intensity, mode, onApply]);

  const renderEffect = () => {
    if (!image || !touchPoint || !isPreview) return null;

    const scale = mode === 'bloat' ? intensity : -intensity;
    
    shader?.setUniform('center', [touchPoint.x, touchPoint.y]);
    shader?.setUniform('radius', radius);
    shader?.setUniform('scale', scale);
    shader?.setUniform('resolution', [width, height]);
    shader?.setImageShader('image', image);

    return (
      <Group>
        <Paint shader={shader}>
          <SkiaImage
            image={image}
            fit="contain"
            x={0}
            y={0}
            width={width}
            height={height}
          />
        </Paint>
      </Group>
    );
  };

  const renderOverlay = () => {
    if (!touchPoint) return null;

    const color = mode === 'bloat' ? 'rgba(255, 100, 100, 0.3)' : 'rgba(100, 100, 255, 0.3)';
    
    return (
      <>
        <Circle
          cx={touchPoint.x}
          cy={touchPoint.y}
          r={radius}
          color={color}
          style="fill"
        />
        <Circle
          cx={touchPoint.x}
          cy={touchPoint.y}
          r={radius}
          color="rgba(255, 255, 255, 0.5)"
          style="stroke"
          strokeWidth={2}
        />
      </>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback
        onPressIn={handleTouch}
        onPressOut={handleRelease}
      >
        <View style={styles.canvasContainer}>
          <Canvas style={{ width, height }}>
            {isPreview && touchPoint ? (
              renderEffect()
            ) : (
              image && (
                <SkiaImage
                  image={image}
                  fit="contain"
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                />
              )
            )}
            
            {renderOverlay()}
          </Canvas>
        </View>
      </TouchableWithoutFeedback>
      
      <View style={styles.controls}>
        <SegmentedControlIOS
          values={['Bloat', 'Pucker']}
          selectedIndex={mode === 'bloat' ? 0 : 1}
          onChange={(event) => {
            const index = event.nativeEvent.selectedSegmentIndex;
            setMode(index === 0 ? 'bloat' : 'pucker');
          }}
          style={styles.segmentedControl}
        />
        
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Radius: {Math.round(radius)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={200}
            value={radius}
            onValueChange={setRadius}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#007AFF"
          />
        </View>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Intensity: {Math.round(intensity * 100)}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1}
            maximumValue={0.8}
            value={intensity}
            onValueChange={setIntensity}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#007AFF"
          />
        </View>
        
        <Text style={styles.helpText}>
          Tap and hold on the area you want to {mode === 'bloat' ? 'enlarge' : 'shrink'}
        </Text>
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
  segmentedControl: {
    marginBottom: 20,
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
  helpText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});