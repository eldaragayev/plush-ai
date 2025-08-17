import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Text,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import Slider from '@react-native-community/slider';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import {
  Canvas,
  Image as SkiaImage,
  Circle,
  Skia,
  useImage,
  Group,
  Paint,
  TileMode,
  FilterMode,
  MipmapMode,
} from '@shopify/react-native-skia';
import { Point } from '../types';

interface MagnifierToolProps {
  imageUri: string;
  width: number;
  height: number;
  onApply: (center: Point, radius: number, scale: number) => void;
}

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

  // Create the magnifier shader source
  const source = useMemo(() => {
    return Skia.RuntimeEffect.Make(`
      uniform shader image;
      uniform vec2 center;
      uniform float radius;
      uniform float scale;
      uniform vec2 resolution;

      vec4 main(vec2 pos) {
        vec2 coord = pos;
        vec2 delta = coord - center;
        float dist = length(delta);
        
        if (dist < radius) {
          float factor = smoothstep(radius, 0.0, dist);
          vec2 direction = normalize(delta);
          
          // Apply bulge/pinch effect
          float displacement = factor * scale * radius;
          coord = coord - direction * displacement;
        }
        
        return image.eval(coord);
      }
    `);
  }, []);

  const handleTouch = useCallback((event: GestureResponderEvent) => {
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

  // Create uniforms for the shader
  const uniforms = useMemo(() => {
    if (!touchPoint || !source) return null;
    
    const scale = mode === 'bloat' ? intensity : -intensity;
    
    return {
      center: [touchPoint.x, touchPoint.y],
      radius: radius,
      scale: scale,
      resolution: [width, height],
    };
  }, [touchPoint, mode, intensity, radius, width, height, source]);

  const renderCanvas = () => {
    if (!image) return null;

    // If we're previewing and have valid shader setup
    if (isPreview && touchPoint && source && uniforms) {
      const paint = Skia.Paint();
      
      // Create the shader with the image
      const uniformsArray = [
        touchPoint.x, touchPoint.y,  // center
        radius,                       // radius  
        mode === 'bloat' ? intensity : -intensity,  // scale
        width, height                 // resolution
      ];
      
      const imageShader = image.makeShaderOptions(
        TileMode.Clamp, 
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None
      );
      const shader = source.makeShaderWithChildren(
        uniformsArray,
        [imageShader]
      );
      
      if (shader) {
        paint.setShader(shader);
        
        return (
          <Group>
            <Paint paint={paint}>
              <SkiaImage
                image={image}
                fit="contain"
                x={0}
                y={0}
                width={width}
                height={height}
              />
            </Paint>
            {renderOverlay()}
          </Group>
        );
      }
    }

    // Default: just show the image
    return (
      <>
        <SkiaImage
          image={image}
          fit="contain"
          x={0}
          y={0}
          width={width}
          height={height}
        />
        {renderOverlay()}
      </>
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
            {renderCanvas()}
          </Canvas>
        </View>
      </TouchableWithoutFeedback>
      
      <View style={styles.controls}>
        <SegmentedControl
          values={['Bloat', 'Pucker']}
          selectedIndex={mode === 'bloat' ? 0 : 1}
          onChange={(event: any) => {
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