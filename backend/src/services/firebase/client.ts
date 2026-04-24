import admin from 'firebase-admin';
import { config } from '../../config';
import logger from '../../utils/logger';

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface MulticastNotification {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface TopicNotification {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export class FirebaseClient {
  private app: admin.app.App;
  private messaging: admin.messaging.Messaging;

  constructor() {
    // Skip initialization if Firebase credentials are not configured
    if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
      logger.warn('Firebase credentials not configured — push notifications disabled');
      this.app = null as any;
      this.messaging = null as any;
      return;
    }
    // Initialize Firebase Admin SDK
    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
      databaseURL: config.firebase.databaseUrl,
    });

    this.messaging = admin.messaging(this.app);
    logger.info('Firebase Admin SDK initialized');
  }

  /**
   * Send push notification to a single device
   */
  async sendPushNotification(notification: PushNotification): Promise<string> {
    if (!this.messaging) {
      logger.warn('Firebase not configured — skipping push notification');
      return 'not-configured';
    }
    try {
      const message: admin.messaging.Message = {
        token: notification.token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: notification.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await this.messaging.send(message);
      logger.info('Push notification sent successfully', { messageId, token: notification.token });
      return messageId;
    } catch (error: any) {
      logger.error('Failed to send push notification', { error, notification });
      throw new Error(`Failed to send push notification: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendMulticastNotification(
    notification: MulticastNotification
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: notification.tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: notification.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(message);
      logger.info('Multicast notification sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      return response;
    } catch (error: any) {
      logger.error('Failed to send multicast notification', { error, notification });
      throw new Error(`Failed to send multicast notification: ${error.message}`);
    }
  }

  /**
   * Send notification to a topic
   */
  async sendTopicNotification(notification: TopicNotification): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        topic: notification.topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: notification.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await this.messaging.send(message);
      logger.info('Topic notification sent successfully', { messageId, topic: notification.topic });
      return messageId;
    } catch (error: any) {
      logger.error('Failed to send topic notification', { error, notification });
      throw new Error(`Failed to send topic notification: ${error.message}`);
    }
  }

  /**
   * Subscribe device tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.messaging) { logger.warn("Firebase not configured"); return; }
    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);
      logger.info('Subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error: any) {
      logger.error('Failed to subscribe to topic', { error, topic });
      throw new Error(`Failed to subscribe to topic: ${error.message}`);
    }
  }

  /**
   * Unsubscribe device tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.messaging) { logger.warn("Firebase not configured"); return; }
    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
      logger.info('Unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error: any) {
      logger.error('Failed to unsubscribe from topic', { error, topic });
      throw new Error(`Failed to unsubscribe from topic: ${error.message}`);
    }
  }

  /**
   * Validate device token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      await this.messaging.send({ token }, true); // Dry run
      return true;
    } catch (error: any) {
      if (error.code === 'messaging/invalid-registration-token') {
        return false;
      }
      throw error;
    }
  }
}

export const firebaseClient = new FirebaseClient();
