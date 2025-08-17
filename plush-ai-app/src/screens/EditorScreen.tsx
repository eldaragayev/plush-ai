import React, { useState, useEffect, useCallback } from 'react';
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
import { EditSession, Tool, Operation, ToolConfig, Point, Stroke } from '../types';
import { SessionStorageService } from '../services/sessionStorage';
import { ImageUtils } from '../utils/imageUtils';
import { OperationStackManager } from '../services/operationStack';
import { TOOLS } from '../constants';
import LiquifyTool from '../components/LiquifyTool';
import MagnifierTool from '../components/MagnifierTool';
import MagnifierToolGL from '../components/MagnifierToolGL';

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
  const [operationStack, setOperationStack] = useState<OperationStackManager | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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
      
      // Initialize operation stack
      const stack = new OperationStackManager(currentSession.ops);
      stack.onChange((ops) => {
        setSession(prev => prev ? { ...prev, ops } : null);
      });
      setOperationStack(stack);

      // Calculate canvas size to fit screen
      const size = ImageUtils.calculateAspectRatioFit(
        currentSession.width,
        currentSession.height,
        screenWidth,
        screenHeight - 250
      );
      setCanvasSize(size);
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
    setSelectedTool(selectedTool === tool ? null : tool);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleUndo = () => {
    if (!operationStack) return;
    operationStack.undo();
  };

  const handleRedo = () => {
    if (!operationStack) return;
    operationStack.redo();
  };

  const handleResetTool = () => {
    if (!selectedTool || !operationStack) return;
    
    // Reset operations for current tool
    if (selectedTool === 'liquify') {
      operationStack.resetTool('liquify');
    } else if (selectedTool === 'magnifier') {
      operationStack.resetTool('magnifier');
    }
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleLiquifyStroke = useCallback((stroke: Stroke) => {
    if (!operationStack) return;
    
    operationStack.addOperation({
      type: 'liquify',
      strokes: [stroke],
    });
  }, [operationStack]);

  const handleMagnifierApply = useCallback((center: Point, radius: number, scale: number) => {
    if (!operationStack) return;
    
    operationStack.addOperation({
      type: 'magnifier',
      center,
      radius,
      scale,
    });
  }, [operationStack]);

  const renderTool = () => {
    if (!session || !image) return null;

    switch (selectedTool) {
      case 'liquify':
        return (
          <LiquifyTool
            imageUri={session.sourceUri}
            width={canvasSize.width}
            height={canvasSize.height}
            onStrokeEnd={handleLiquifyStroke}
          />
        );
      
      case 'magnifier':
        return (
          <MagnifierToolGL
            imageUri={session.sourceUri}
            width={canvasSize.width}
            height={canvasSize.height}
            onApply={handleMagnifierApply}
          />
        );
      
      default:
        // Default canvas view
        return (
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
        );
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

  const canUndo = operationStack?.canUndo() || false;
  const canRedo = operationStack?.canRedo() || false;

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

      {renderTool()}

      {!selectedTool && (
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
      )}

      {selectedTool && (
        <TouchableOpacity
          style={styles.closeTool}
          onPress={() => setSelectedTool(null)}
        >
          <Text style={styles.closeToolText}>Done</Text>
        </TouchableOpacity>
      )}
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
  closeTool: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeToolText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});