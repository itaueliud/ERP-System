import { FirebaseClient } from './client';
import admin from 'firebase-admin';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  messaging: jest.fn(),
}));

jest.mock('../../config', () => ({
  config: {
    firebase: {
      projectId: 'test-project',
      privateKey: 'test-key',
      clientEmail: 'test@test.com',
      databaseUrl: 'https://test.firebaseio.com',
    },
  },
}));

describe('FirebaseClient', () => {
  let client: FirebaseClient;
  let mockMessaging: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMessaging = {
      send: jest.fn(),
      sendEachForMulticast: jest.fn(),
      subscribeToTopic: jest.fn(),
      unsubscribeFromTopic: jest.fn(),
    };

    (admin.messaging as jest.Mock).mockReturnValue(mockMessaging);
    
    client = new FirebaseClient();
  });

  describe('sendPushNotification', () => {
    it('should send push notification successfully', async () => {
      const messageId = 'msg-123';
      mockMessaging.send.mockResolvedValue(messageId);

      const result = await client.sendPushNotification({
        token: 'device-token',
        title: 'Test Notification',
        body: 'Test message',
        data: { key: 'value' },
      });

      expect(result).toBe(messageId);
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'device-token',
          notification: {
            title: 'Test Notification',
            body: 'Test message',
            imageUrl: undefined,
          },
          data: { key: 'value' },
        })
      );
    });

    it('should handle send failure', async () => {
      mockMessaging.send.mockRejectedValue(new Error('Send failed'));

      await expect(
        client.sendPushNotification({
          token: 'device-token',
          title: 'Test',
          body: 'Test',
        })
      ).rejects.toThrow('Failed to send push notification');
    });
  });

  describe('sendMulticastNotification', () => {
    it('should send multicast notification successfully', async () => {
      const mockResponse = {
        successCount: 2,
        failureCount: 0,
        responses: [],
      };
      mockMessaging.sendEachForMulticast.mockResolvedValue(mockResponse);

      const result = await client.sendMulticastNotification({
        tokens: ['token1', 'token2'],
        title: 'Test Notification',
        body: 'Test message',
      });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('sendTopicNotification', () => {
    it('should send topic notification successfully', async () => {
      const messageId = 'msg-123';
      mockMessaging.send.mockResolvedValue(messageId);

      const result = await client.sendTopicNotification({
        topic: 'test-topic',
        title: 'Test Notification',
        body: 'Test message',
      });

      expect(result).toBe(messageId);
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
        })
      );
    });
  });

  describe('subscribeToTopic', () => {
    it('should subscribe tokens to topic successfully', async () => {
      mockMessaging.subscribeToTopic.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
      });

      await client.subscribeToTopic(['token1', 'token2'], 'test-topic');

      expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(
        ['token1', 'token2'],
        'test-topic'
      );
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      mockMessaging.send.mockResolvedValue('msg-123');

      const isValid = await client.validateToken('valid-token');

      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const error: any = new Error('Invalid token');
      error.code = 'messaging/invalid-registration-token';
      mockMessaging.send.mockRejectedValue(error);

      const isValid = await client.validateToken('invalid-token');

      expect(isValid).toBe(false);
    });
  });
});
