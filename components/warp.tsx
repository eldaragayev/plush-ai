import { useEffect, useRef, useState } from 'react';
import { Dimensions, View, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ImageWarpView, ImageWarpRef } from './native/ImageWarpView';

const { width, height } = Dimensions.get('window');

export default function WarpScreen() {
  const ref = useRef<ImageWarpRef>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>([width/2, height/2]);
  const [radius, setRadius] = useState(120);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    (async () => {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (!res.canceled) setSrc(res.assets[0].uri);
    })();
  }, []);

  const pan = Gesture.Pan().onChange(e => setCenter([e.absoluteX, e.absoluteY]));
  const pinch = Gesture.Pinch().onChange(e => setRadius(r => Math.max(20, Math.min(500, r * e.scale))));

  if (!src) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <ImageWarpView
          source={src}
          center={center}
          radius={radius}
          scale={scale}
          mode="pinch"
          style={{ width, height }}
        />
      </GestureDetector>
      <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
        <Button title="Shrink more" onPress={() => setScale(s => Math.min(1, s + 0.05))} />
        <Button title="Export" onPress={async () => {
          const uri = await ref.current?.saveAsync();
          console.log('Saved:', uri);
        }} />
      </View>
    </View>
  );
}
