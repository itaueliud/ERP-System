# Chat Module

Real-time chat and communication system for the TechSwiftTrix ERP System.

## Features

### Core Chat Functionality
- **Real-time messaging** via Socket.IO (Requirement 13.1)
- **One-on-one direct messages** (Requirement 13.2)
- **Group chat channels** for departments and projects (Requirement 13.3)
- **Message delivery** within 2 seconds (Requirement 13.4)
- **Unread message count** tracking (Requirement 13.5)
- **90-day message history** retention (Requirement 13.6)
- **File attachments** up to 10 MB (Requirement 13.8)
- **Online/offline status** tracking (Requirement 13.10)

### Advanced Features (Task 15.3)
- **@mention notifications** - Users receive notifications when mentioned in messages (Requirement 13.11)
- **Chat history search** - Full-text search by keyword with filters (Requirement 13.7)
- **Mute channels** - Users can mute/unmute chat rooms (Requirement 13.12)
- **User avatars and status** - Display user presence and profile information

## API Endpoints

### Room Management
- `POST /api/chat/rooms` - Create a new chat room
- `GET /api/chat/rooms` - Get all rooms for authenticated user
- `GET /api/chat/rooms/:roomId` - Get room details
- `POST /api/chat/rooms/direct` - Get or create direct message room
- `POST /api/chat/rooms/:roomId/members` - Add member to room
- `DELETE /api/chat/rooms/:roomId/members/:userId` - Remove member from room

### Messages
- `POST /api/chat/rooms/:roomId/messages` - Send a message
- `GET /api/chat/rooms/:roomId/messages` - Get message history
- `GET /api/chat/rooms/:roomId/search` - Search messages by keyword
- `GET /api/chat/rooms/:roomId/unread` - Get unread message count
- `POST /api/chat/rooms/:roomId/read` - Mark room as read

### Mute Functionality
- `POST /api/chat/rooms/:roomId/mute` - Mute a room
- `DELETE /api/chat/rooms/:roomId/mute` - Unmute a room
- `GET /api/chat/muted-rooms` - Get all muted rooms

### Presence
- `GET /api/chat/online-users` - Get list of online users

## Service Methods

### ChatService

#### Room Management
- `createRoom(type, name, memberIds)` - Create a new chat room
- `getRoom(roomId)` - Get room details
- `getRoomsForUser(userId)` - Get all rooms for a user
- `getOrCreateDirectRoom(userId1, userId2)` - Get or create direct message room
- `addMember(roomId, userId)` - Add member to room
- `removeMember(roomId, userId)` - Remove member from room
- `getMembers(roomId)` - Get all room members

#### Messages
- `sendMessage(roomId, senderId, content, fileId?)` - Send a message (auto-detects @mentions)
- `getMessages(roomId, filters?)` - Get message history with pagination
- `searchMessages(roomId, keyword, filters?)` - Search messages by keyword
- `getUnreadCount(roomId, userId)` - Get unread message count
- `markRoomAsRead(roomId, userId)` - Mark all messages as read
- `deleteOldMessages(daysOld?)` - Delete messages older than retention period

#### Mentions
- `extractMentions(content)` - Extract @mentions from message content
- `notifyMentionedUsers(message, mentions)` - Send notifications to mentioned users

#### Mute
- `muteRoom(roomId, userId)` - Mute a room for a user
- `unmuteRoom(roomId, userId)` - Unmute a room for a user
- `isMuted(roomId, userId)` - Check if room is muted
- `getMutedRooms(userId)` - Get all muted rooms for a user

### ChatServer (Socket.IO)

#### Connection Management
- `initialize(httpServer)` - Attach Socket.IO to HTTP server
- `handleConnection(socket)` - Handle new WebSocket connection
- `handleDisconnect(socket)` - Handle WebSocket disconnection

#### Room Operations
- `joinRoom(socket, roomId)` - Join a chat room
- `leaveRoom(socket, roomId)` - Leave a chat room
- `emitToRoom(roomId, event, data)` - Emit event to all sockets in room
- `emitToUser(userId, event, data)` - Emit event to specific user

#### Presence
- `getOnlineUsers()` - Get list of online user IDs
- `isUserOnline(userId)` - Check if user is online

#### Message Handling
- `handleMessageSend(socket, data)` - Handle 'message:send' event

## Socket.IO Events

### Client → Server
- `room:join` - Join a chat room
- `room:leave` - Leave a chat room
- `message:send` - Send a message

### Server → Client
- `message:new` - New message received
- `message:error` - Message sending error
- `presence:update` - User online/offline status changed

## Database Schema

### chat_rooms
- `id` - UUID primary key
- `name` - Room name (nullable for direct messages)
- `type` - Room type (DIRECT, GROUP, DEPARTMENT, PROJECT)
- `metadata` - JSON metadata
- `created_at` - Creation timestamp

### chat_room_members
- `id` - UUID primary key
- `room_id` - Foreign key to chat_rooms
- `user_id` - Foreign key to users
- `joined_at` - Join timestamp
- `last_read_at` - Last read timestamp
- `muted` - Boolean flag for muted status

### chat_messages
- `id` - UUID primary key
- `room_id` - Foreign key to chat_rooms
- `sender_id` - Foreign key to users
- `content` - Message text
- `file_id` - Foreign key to files (nullable)
- `created_at` - Creation timestamp

## Usage Examples

### Send a message with @mentions
```typescript
const message = await chatService.sendMessage(
  'room-123',
  'user-456',
  'Hey @alice and @bob, check this out!'
);
// Notifications automatically sent to alice and bob
```

### Search chat history
```typescript
const results = await chatService.searchMessages(
  'room-123',
  'project deadline',
  { limit: 20, offset: 0 }
);
```

### Mute a channel
```typescript
await chatService.muteRoom('room-123', 'user-456');
const isMuted = await chatService.isMuted('room-123', 'user-456'); // true
```

### Get muted rooms
```typescript
const mutedRooms = await chatService.getMutedRooms('user-456');
```

## Testing

Run tests:
```bash
npm test src/chat/chatService.test.ts
```

All 49 tests cover:
- Room creation and management
- Message sending and retrieval
- @mention extraction and notifications
- Search functionality
- Mute/unmute operations
- Unread count tracking
- Message retention cleanup
