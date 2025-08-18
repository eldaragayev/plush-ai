import "./global.css";
import { useState } from "react";
import { Text, View, TouchableOpacity, Image } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";

export default function App() {
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      edges={["left", "right", "bottom"]}
    >
      <StatusBar style="dark" />
      {/* Header */}
      <View
        className="px-6 pb-2 bg-gray-50"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Text className="text-3xl font-semibold tracking-tight text-gray-900">
          Editor
        </Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-4 py-6">
        {!selectedImage ? (
          /* Image Picker Section */
          <View className="flex-1 items-stretch justify-center">
            <View className="max-w-md w-full self-center">
              <View className="border-2 border-dashed border-gray-300 rounded-3xl bg-white/80 p-6">
                <View className="aspect-[4/3] rounded-2xl bg-gray-100 items-center justify-center">
                  <Text className="text-5xl">🖼️</Text>
                </View>

                <Text className="text-center text-gray-900 text-lg font-medium mt-6">
                  Select a photo
                </Text>
                <Text className="text-center text-gray-500 mt-1">
                  Choose from your library to begin
                </Text>

                <TouchableOpacity
                  onPress={pickImage}
                  className="mt-6 h-14 rounded-full bg-gray-900 items-center justify-center active:bg-black shadow-sm"
                >
                  <Text className="text-white text-base font-semibold">
                    Choose Photo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* Image Display Section */
          <View className="flex-1 max-w-md w-full self-center">
            {/* Image Container */}
            <View className="flex-1 rounded-3xl bg-black overflow-hidden">
              <Image
                source={{ uri: selectedImage }}
                className="flex-1 w-full"
                resizeMode="contain"
              />
            </View>

            {/* Action Buttons */}
            <View className="mt-6 flex-row gap-3">
              <TouchableOpacity
                onPress={clearImage}
                className="flex-1 h-12 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
              >
                <Text className="text-gray-800 font-medium">Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickImage}
                className="flex-1 h-12 rounded-full bg-gray-900 items-center justify-center active:bg-black shadow-sm"
              >
                <Text className="text-white font-semibold">Replace</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
