import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  PanResponder,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-expo';
import GLImage from 'gl-react-image';
import { Point } from '../types';

const shaders = Shaders.create({
  bulge: {
    frag: GLSL`
precision highp float;
varying vec2 uv;

uniform sampler2D image;
uniform vec2 center;
uniform float radius;
uniform float strength;
uniform vec2 resolution;

void main() {
  vec2 coord = uv * resolution;
  vec2 toCenter = center - coord;
  float distance = length(toCenter);
  
  if (distance < radius) {
    float percent = distance / radius;
    float amount = 0.0;
    
    if (strength > 0.0) {
      // Bulge effect
      amount = 1.0 - percent;
      amount = amount * amount;
      amount = amount * strength;
    } else {
      // Pinch effect
      amount = percent;
      amount = 1.0 - amount * amount;
      amount = amount * abs(strength);
      amount = -amount;
    }
    
    coord = coord - toCenter * amount;
  }
  
  gl_FragColor = texture2D(image, coord / resolution);
}
`
  }
});

interface MagnifierToolGLProps {
  imageUri: string;
  width: number;
  height: number;
  onApply: (center: Point, radius: number, scale: number) => void;
}

export default function MagnifierToolGL({
  imageUri,
  width,
  height,
  onApply,
}: MagnifierToolGLProps) {
  const [circlePosition, setCirclePosition] = useState<Point>({
    x: width / 2,
    y: height / 2,
  });
  
  const [radius, setRadius] = useState(80);
  const [intensity, setIntensity] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Create PanResponder for dragging the circle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const dx = evt.nativeEvent.locationX - circlePosition.x;
        const dy = evt.nativeEvent.locationY - circlePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= radius;
      },
      
      onMoveShouldSetPanResponder: () => isDragging,
      
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      
      onPanResponderMove: (evt) => {
        const newX = Math.max(radius, Math.min(width - radius, evt.nativeEvent.locationX));
        const newY = Math.max(radius, Math.min(height - radius, evt.nativeEvent.locationY));
        
        setCirclePosition({ x: newX, y: newY });
      },
      
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
    })
  ).current;

  const handleIntensityChange = useCallback((value: number) => {
    setIntensity(value);
  }, []);

  const handleIntensityChangeEnd = useCallback((value: number) => {
    if (Math.abs(value) > 0.01) {
      onApply(circlePosition, radius, value);
    }
  }, [circlePosition, radius, onApply]);

  const handleRadiusChange = useCallback((value: number) => {
    setRadius(value);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Surface style={{ width, height }}>
          <Node
            shader={shaders.bulge}
            uniforms={{
              image: imageUri,
              center: [circlePosition.x, circlePosition.y],
              radius: radius,
              strength: intensity,
              resolution: [width, height],
            }}
          >
            <GLImage
              source={{ uri: imageUri }}
              imageSize={{ width, height }}
              resizeMode="contain"
            />
          </Node>
        </Surface>
        
        {/* Overlay circle indicator */}
        <View
          style={[
            styles.circleOverlay,
            {
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              left: circlePosition.x - radius,
              top: circlePosition.y - radius,
            }
          ]}
        />
      </View>
      
      <View style={styles.controls}>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>
            Intensity: {intensity > 0 ? 'Bulge' : intensity < 0 ? 'Pinch' : 'None'} ({Math.round(Math.abs(intensity) * 100)}%)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={-1}
            maximumValue={1}
            value={intensity}
            onValueChange={handleIntensityChange}
            onSlidingComplete={handleIntensityChangeEnd}
            minimumTrackTintColor={intensity < 0 ? "#4A90E2" : "#8E8E93"}
            maximumTrackTintColor={intensity > 0 ? "#FF6B6B" : "#8E8E93"}
            thumbTintColor="#FFFFFF"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderEndLabel}>Pinch</Text>
            <Text style={styles.sliderCenterLabel}>|</Text>
            <Text style={styles.sliderEndLabel}>Bulge</Text>
          </View>
        </View>
        
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Radius: {Math.round(radius)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={30}
            maximumValue={150}
            value={radius}
            onValueChange={handleRadiusChange}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#FFFFFF"
          />
        </View>
        
        <Text style={styles.helpText}>
          Drag the circle to position • Adjust intensity to see effect
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
  circleOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    pointerEvents: 'none',
  },
  controls: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderEndLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  sliderCenterLabel: {
    color: '#8E8E93',
    fontSize: 12,
    position: 'absolute',
    left: '50%',
    marginLeft: -4,
  },
  helpText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});