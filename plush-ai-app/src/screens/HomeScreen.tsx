import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
  Pressable,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../navigation/AppNavigator';
import { EditSession } from '../types';
import { SessionStorageService } from '../services/sessionStorage';
import { ImageUtils } from '../utils/imageUtils';
import { HISTORY_LIMIT } from '../constants';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

const { width: screenWidth } = Dimensions.get('window');
const gridItemSize = (screenWidth - 48) / 3;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [sessions, setSessions] = useState<EditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const storageService = SessionStorageService.getInstance();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const loadedSessions = await storageService.getAllSessions();
      setSessions(loadedSessions.slice(0, HISTORY_LIMIT));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleCreatePress = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Camera', 'Photo Library'],
        cancelButtonIndex: 0,
        tintColor: '#007AFF',
      },
      async (buttonIndex) => {
        if (buttonIndex === 1) {
          await openCamera();
        } else if (buttonIndex === 2) {
          await openPhotoLibrary();
        }
      }
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera permission to capture photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      navigateToEditor(result.assets[0].uri);
    }
  };

  const openPhotoLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library permission to select photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      navigateToEditor(result.assets[0].uri);
    }
  };

  const navigateToEditor = (imageUri: string) => {
    navigation.navigate('Editor', { imageUri });
  };

  const handleSessionPress = (session: EditSession) => {
    navigation.navigate('Editor', { session });
  };

  const handleSessionLongPress = (session: EditSession) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      'Delete Edit',
      'Are you sure you want to delete this edit from your device?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteSession(session.id);
              await loadSessions();
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete edit. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderHistoryItem = ({ item }: { item: EditSession }) => {
    const thumbnailUri = item.previewUri || item.sourceUri;
    const dateStr = new Date(item.updatedAt).toLocaleDateString();

    return (
      <Pressable
        style={styles.gridItem}
        onPress={() => handleSessionPress(item)}
        onLongPress={() => handleSessionLongPress(item)}
      >
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
        <Text style={styles.dateText}>{dateStr}</Text>
      </Pressable>
    );
  };

  const renderEmptyHistory = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Edits Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your edited photos will appear here
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.appTitle}>Plush AI</Text>
      
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreatePress}
        activeOpacity={0.8}
      >
        <View style={styles.createButtonContent}>
          <Text style={styles.createIcon}>📸</Text>
          <View>
            <Text style={styles.createTitle}>Create New Edit</Text>
            <Text style={styles.createSubtitle}>
              Capture or select a photo to enhance
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {sessions.length > 0 && (
        <Text style={styles.sectionTitle}>Recent Edits</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sessions}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={sessions.length > 0 ? styles.row : undefined}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyHistory}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={loadSessions}
        refreshing={refreshing}
        removeClippedSubviews={true}
        maxToRenderPerBatch={9}
        windowSize={10}
        initialNumToRender={9}
        getItemLayout={(_, index) => ({
          length: gridItemSize + 40,
          offset: (gridItemSize + 40) * Math.floor(index / 3),
          index,
        })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  createSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: gridItemSize,
    marginBottom: 12,
  },
  thumbnail: {
    width: gridItemSize,
    height: gridItemSize,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});