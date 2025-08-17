import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Canvas, useImage, Image as SkiaImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../navigation/AppNavigator';
import { EditSession, Tool, Operation, ToolConfig } from '../types';
import { SessionStorageService } from '../services/sessionStorage';
import { ImageUtils } from '../utils/imageUtils';
import { TOOLS } from '../constants';

type EditorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Editor'>;
type EditorScreenRouteProp = RouteProp<RootStackParamList, 'Editor'>;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function EditorScreen() {
  const navigation = useNavigation<EditorScreenNavigationProp>();
  const route = useRoute<EditorScreenRouteProp>();
  const storageService = SessionStorageService.getInstance();

  const [session, setSession] = useState<EditSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoStack, setUndoStack] = useState<Operation[][]>([]);
  const [redoStack, setRedoStack] = useState<Operation[][]>([]);

  const image = useImage(session?.sourceUri || '');

  useEffect(() => {
    initializeEditor();
  }, []);

  const initializeEditor = async () => {
    try {
      let currentSession: EditSession;

      if (route.params?.session) {
        currentSession = route.params.session;
      } else if (route.params?.imageUri) {
        const dimensions = await ImageUtils.getImageDimensions(route.params.imageUri);
        const sessionId = ImageUtils.generateSessionId();
        const copiedUri = await ImageUtils.copyToAppDirectory(route.params.imageUri);

        currentSession = {
          id: sessionId,
          sourceUri: copiedUri,
          width: dimensions.width,
          height: dimensions.height,
          ops: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storageService.saveSession(currentSession);
      } else {
        navigation.goBack();
        return;
      }

      setSession(currentSession);
      setCanUndo(currentSession.ops.length > 0);
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      Alert.alert('Error', 'Failed to load image. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (session && session.ops.length > 0) {
      Alert.alert(
        'Save Changes?',
        'Do you want to save your edits before leaving?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Save',
            onPress: async () => {
              await handleSave();
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!session) return;

    setIsProcessing(true);
    try {
      session.updatedAt = Date.now();
      await storageService.saveSession(session);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save edits. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleUndo = () => {
    if (!session || session.ops.length === 0) return;

    const newOps = [...session.ops];
    const lastOp = newOps.pop();
    
    if (lastOp) {
      setRedoStack([...redoStack, [lastOp]]);
      setSession({ ...session, ops: newOps });
      setCanUndo(newOps.length > 0);
      setCanRedo(true);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !session) return;

    const newRedoStack = [...redoStack];
    const opsToRedo = newRedoStack.pop();
    
    if (opsToRedo) {
      const newOps = [...session.ops, ...opsToRedo];
      setSession({ ...session, ops: newOps });
      setRedoStack(newRedoStack);
      setCanUndo(true);
      setCanRedo(newRedoStack.length > 0);
    }
  };

  const handleResetTool = () => {
    if (!selectedTool) return;
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const renderToolButton = (tool: ToolConfig) => (
    <TouchableOpacity
      key={tool.id}
      style={[
        styles.toolButton,
        selectedTool === tool.id && styles.toolButtonActive,
      ]}
      onPress={() => handleToolSelect(tool.id)}
    >
      <Text style={styles.toolIcon}>{tool.icon}</Text>
      <Text style={[
        styles.toolLabel,
        selectedTool === tool.id && styles.toolLabelActive,
      ]}>
        {tool.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading image...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return null;
  }

  const canvasSize = ImageUtils.calculateAspectRatioFit(
    session.width,
    session.height,
    screenWidth,
    screenHeight - 250
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, isProcessing && styles.headerButtonDisabled]}
          disabled={isProcessing}
        >
          <Text style={[
            styles.headerButtonText,
            isProcessing && styles.headerButtonTextDisabled,
          ]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvasContainer}>
        <Canvas style={{ width: canvasSize.width, height: canvasSize.height }}>
          {image && (
            <SkiaImage
              image={image}
              fit="contain"
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          )}
        </Canvas>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlButtons}>
          <TouchableOpacity
            onPress={handleUndo}
            disabled={!canUndo}
            style={[styles.controlButton, !canUndo && styles.controlButtonDisabled]}
          >
            <Text style={styles.controlButtonText}>Undo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleRedo}
            disabled={!canRedo}
            style={[styles.controlButton, !canRedo && styles.controlButtonDisabled]}
          >
            <Text style={styles.controlButtonText}>Redo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleResetTool}
            disabled={!selectedTool}
            style={[styles.controlButton, !selectedTool && styles.controlButtonDisabled]}
          >
            <Text style={styles.controlButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.toolTray}
          contentContainerStyle={styles.toolTrayContent}
        >
          {TOOLS.map(renderToolButton)}
        </ScrollView>
      </View>
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
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
  headerButtonTextDisabled: {
    color: '#8E8E93',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    backgroundColor: '#1C1C1E',
    paddingBottom: 20,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  toolTray: {
    height: 100,
  },
  toolTrayContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolButton: {
    alignItems: 'center',
    marginRight: 20,
    width: 70,
  },
  toolButtonActive: {
    opacity: 1,
  },
  toolIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  toolLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  toolLabelActive: {
    color: '#007AFF',
  },
});