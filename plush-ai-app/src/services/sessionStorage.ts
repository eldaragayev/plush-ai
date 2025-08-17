import * as FileSystem from 'expo-file-system';
import { EditSession } from '../types';
import { HISTORY_LIMIT } from '../constants';

const SESSIONS_DIR = `${FileSystem.documentDirectory}sessions/`;
const SESSIONS_INDEX_FILE = `${SESSIONS_DIR}index.json`;
const THUMBNAILS_DIR = `${SESSIONS_DIR}thumbnails/`;

export class SessionStorageService {
  private static instance: SessionStorageService;

  private constructor() {
    this.initializeDirectories();
  }

  static getInstance(): SessionStorageService {
    if (!SessionStorageService.instance) {
      SessionStorageService.instance = new SessionStorageService();
    }
    return SessionStorageService.instance;
  }

  private async initializeDirectories(): Promise<void> {
    try {
      const sessionsDirInfo = await FileSystem.getInfoAsync(SESSIONS_DIR);
      if (!sessionsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SESSIONS_DIR, { intermediates: true });
      }

      const thumbnailsDirInfo = await FileSystem.getInfoAsync(THUMBNAILS_DIR);
      if (!thumbnailsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(THUMBNAILS_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  async saveSession(session: EditSession): Promise<void> {
    try {
      const sessionPath = `${SESSIONS_DIR}${session.id}.json`;
      await FileSystem.writeAsStringAsync(
        sessionPath,
        JSON.stringify(session),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      await this.updateSessionsIndex(session);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async loadSession(sessionId: string): Promise<EditSession | null> {
    try {
      const sessionPath = `${SESSIONS_DIR}${sessionId}.json`;
      const sessionInfo = await FileSystem.getInfoAsync(sessionPath);
      
      if (!sessionInfo.exists) {
        return null;
      }

      const sessionData = await FileSystem.readAsStringAsync(
        sessionPath,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      return JSON.parse(sessionData) as EditSession;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  async getAllSessions(): Promise<EditSession[]> {
    try {
      const indexInfo = await FileSystem.getInfoAsync(SESSIONS_INDEX_FILE);
      
      if (!indexInfo.exists) {
        return [];
      }

      const indexData = await FileSystem.readAsStringAsync(
        SESSIONS_INDEX_FILE,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const sessionIds: string[] = JSON.parse(indexData);
      const sessions: EditSession[] = [];

      for (const id of sessionIds) {
        const session = await this.loadSession(id);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionPath = `${SESSIONS_DIR}${sessionId}.json`;
      const sessionInfo = await FileSystem.getInfoAsync(sessionPath);
      
      if (sessionInfo.exists) {
        await FileSystem.deleteAsync(sessionPath);
      }

      const thumbnailPath = `${THUMBNAILS_DIR}${sessionId}.jpg`;
      const thumbnailInfo = await FileSystem.getInfoAsync(thumbnailPath);
      
      if (thumbnailInfo.exists) {
        await FileSystem.deleteAsync(thumbnailPath);
      }

      await this.removeFromSessionsIndex(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async saveThumbnail(sessionId: string, thumbnailUri: string): Promise<void> {
    try {
      const thumbnailPath = `${THUMBNAILS_DIR}${sessionId}.jpg`;
      await FileSystem.copyAsync({
        from: thumbnailUri,
        to: thumbnailPath
      });
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
    }
  }

  async getThumbnailUri(sessionId: string): Promise<string | null> {
    try {
      const thumbnailPath = `${THUMBNAILS_DIR}${sessionId}.jpg`;
      const thumbnailInfo = await FileSystem.getInfoAsync(thumbnailPath);
      
      if (thumbnailInfo.exists) {
        return thumbnailPath;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get thumbnail:', error);
      return null;
    }
  }

  private async updateSessionsIndex(session: EditSession): Promise<void> {
    try {
      let sessionIds: string[] = [];
      
      const indexInfo = await FileSystem.getInfoAsync(SESSIONS_INDEX_FILE);
      if (indexInfo.exists) {
        const indexData = await FileSystem.readAsStringAsync(
          SESSIONS_INDEX_FILE,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
        sessionIds = JSON.parse(indexData);
      }

      const index = sessionIds.indexOf(session.id);
      if (index > -1) {
        sessionIds.splice(index, 1);
      }

      sessionIds.unshift(session.id);

      if (sessionIds.length > HISTORY_LIMIT) {
        const sessionsToDelete = sessionIds.slice(HISTORY_LIMIT);
        sessionIds = sessionIds.slice(0, HISTORY_LIMIT);
        
        for (const id of sessionsToDelete) {
          await this.deleteSession(id);
        }
      }

      await FileSystem.writeAsStringAsync(
        SESSIONS_INDEX_FILE,
        JSON.stringify(sessionIds),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to update sessions index:', error);
    }
  }

  private async removeFromSessionsIndex(sessionId: string): Promise<void> {
    try {
      const indexInfo = await FileSystem.getInfoAsync(SESSIONS_INDEX_FILE);
      
      if (!indexInfo.exists) {
        return;
      }

      const indexData = await FileSystem.readAsStringAsync(
        SESSIONS_INDEX_FILE,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      let sessionIds: string[] = JSON.parse(indexData);
      sessionIds = sessionIds.filter(id => id !== sessionId);

      await FileSystem.writeAsStringAsync(
        SESSIONS_INDEX_FILE,
        JSON.stringify(sessionIds),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to remove from sessions index:', error);
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      const sessionsDirInfo = await FileSystem.getInfoAsync(SESSIONS_DIR);
      if (sessionsDirInfo.exists) {
        await FileSystem.deleteAsync(SESSIONS_DIR, { idempotent: true });
        await this.initializeDirectories();
      }
    } catch (error) {
      console.error('Failed to clear all sessions:', error);
    }
  }
}