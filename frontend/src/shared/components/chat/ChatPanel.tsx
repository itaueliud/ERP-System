import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../api/apiClient';
import { useChatSocket, ChatMessage, PresenceUpdate } from './useChatSocket';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatUser {
  id: string; name: string; email: string; role: string;
  department?: string | null;
  isTeamLeader?: boolean;
  profilePhotoUrl: string | null; online: boolean; portal: string | null;
}
interface Conversation {
  roomId: string; user: ChatUser; messages: ChatMessage[]; unread: number;
}
interface ChatPanelProps {
  token: string; currentUserId: string; portal: string; inlineMode?: boolean;
}

// Extend ChatMessage with new fields from backend
declare module './useChatSocket' {
  interface ChatMessage {
    readBy?: string[];
    isDeletedForEveryone?: boolean;
  }
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  sidebarBg: '#f0f4ff', sidebarBorder: '#dde3f5',
  chatBg: '#ffffff', rightBg: '#f7f9ff',
  accent: '#4f6ef7', accentDark: '#3a56d4', accentLight: '#eef1ff',
  myBubble: '#4f6ef7', myText: '#ffffff',
  theirBubble: '#eef1ff', theirText: '#1e2a4a',
  textPrimary: '#1e2a4a', textSecond: '#6b7a99', textMuted: '#9aa3be',
  online: '#22c55e', offline: '#cbd5e1', border: '#e4e9f7',
};

const PORTAL_COLORS: Record<string, string> = {
  'CEO Portal': '#4f6ef7', 'Executive Portal': '#7c3aed',
  'C-Level Portal': '#0891b2', 'Operations Portal': '#16a34a',
  'Technology Portal': '#d97706', 'Agents Portal': '#e11d48',
};
const portalColor = (p: string | null) => p ? (PORTAL_COLORS[p] || '#6b7a99') : '#6b7a99';

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = 40, color = C.accent }: {
  name: string; photoUrl?: string | null; size?: number; color?: string;
}) {
  if (photoUrl) return (
    <img src={photoUrl} alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.5px',
    }}>
      {name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
    </div>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', margin: '12px 14px' }}>
      <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}
        width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search Here...'}
        style={{
          width: '100%', padding: '8px 10px 8px 30px', borderRadius: 20,
          border: `1px solid ${C.border}`, fontSize: 12, outline: 'none',
          background: '#fff', color: C.textPrimary, boxSizing: 'border-box',
        }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatPanel({ token, currentUserId, portal, inlineMode = false }: ChatPanelProps) {
  const [open, setOpen] = useState(inlineMode);
  const [view, setView] = useState<'list' | 'users' | 'chat'>('list');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [openingDM, setOpeningDM] = useState<string | null>(null);
  const [dmError, setDmError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null); // context menu
  // Banner: shown when a new message arrives from someone not currently open
  const [newMsgBanner, setNewMsgBanner] = useState<{ name: string; count: number } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  // ── Socket ──────────────────────────────────────────────────────────────────
  const handleMessage = useCallback((msg: ChatMessage) => {
    const existing = conversationsRef.current.find(c => c.roomId === msg.roomId);

    // Helper: merge the real message in, replacing any matching optimistic one
    const mergeMsg = (msgs: ChatMessage[]): ChatMessage[] => {
      if (msg.senderId === currentUserId) {
        // Replace the first optimistic message with same content
        const optIdx = msgs.findIndex(m => m.id.startsWith('opt-') && m.content === msg.content && m.senderId === currentUserId);
        if (optIdx !== -1) {
          const next = [...msgs];
          next[optIdx] = msg;
          return next;
        }
      }
      // Not ours or no optimistic match — just append
      return [...msgs, msg];
    };

    if (existing) {
      setConversations(prev => prev.map(c => {
        if (c.roomId !== msg.roomId) return c;
        const isActive = activeConvRef.current?.roomId === msg.roomId;
        const newUnread = isActive ? 0 : c.unread + 1;
        if (!isActive && msg.senderId !== currentUserId) {
          showBanner(c.user.name, newUnread);
        }
        return { ...c, messages: mergeMsg(c.messages), unread: newUnread };
      }));
      setActiveConv(prev => {
        if (!prev || prev.roomId !== msg.roomId) return prev;
        return { ...prev, messages: mergeMsg(prev.messages) };
      });
    } else {
      fetchAndAddRoom(msg.roomId, msg);
    }
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConvRef = useRef<Conversation | null>(null);
  activeConvRef.current = activeConv;

  const showBanner = useCallback((name: string, count: number) => {
    setNewMsgBanner({ name, count });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setNewMsgBanner(null), 5000);
  }, []);

  const fetchAndAddRoom = useCallback(async (roomId: string, triggerMsg?: ChatMessage) => {
    try {
      // Fetch members of this room to find the other user
      const membersRes = await apiClient.get(`/api/v1/chat/rooms/${roomId}/members`).catch(() => null);
      const memberIds: string[] = (membersRes?.data?.members || membersRes?.data || []).map((m: any) => m.userId || m.user_id || m.id);
      const otherMemberId = memberIds.find((id: string) => id !== currentUserId);
      if (!otherMemberId) return;

      // Get user details from already-loaded users list or fetch fresh
      let chatUser = conversationsRef.current.find(c => c.user.id === otherMemberId)?.user
        || users.find(u => u.id === otherMemberId);
      if (!chatUser) {
        const usersRes = await apiClient.get('/api/v1/chat/users');
        const found = (usersRes.data.users || []).find((u: ChatUser) => u.id === otherMemberId);
        if (!found) return;
        chatUser = found;
        setUsers(usersRes.data.users || []);
      }

      // Load messages — reverse from newest-first to chronological
      const msgRes = await apiClient.get(`/api/v1/chat/rooms/${roomId}/messages`);
      const messages: ChatMessage[] = (msgRes.data.messages || []).slice().reverse();

      const conv: Conversation = { roomId, user: chatUser!, messages, unread: triggerMsg ? 1 : 0 };
      setConversations(prev => {
        if (prev.find(c => c.roomId === roomId)) return prev;
        return [conv, ...prev];
      });
      if (triggerMsg && chatUser) showBanner(chatUser.name, 1);
      joinRoom(roomId);
    } catch { /* silent */ }
  }, [currentUserId, showBanner, users]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePresence = useCallback((update: PresenceUpdate) => {
    setUsers(prev => prev.map(u =>
      u.id === update.userId ? { ...u, online: update.status === 'online', portal: update.portal || null } : u
    ));
    setConversations(prev => prev.map(c =>
      c.user.id === update.userId
        ? { ...c, user: { ...c.user, online: update.status === 'online', portal: update.portal || c.user.portal } }
        : c
    ));
  }, []);

  const { connected, joinRoom, sendMessage } = useChatSocket({ token, portal, onMessage: handleMessage, onPresence: handlePresence, onDeleted: (data) => {
    if (data.forEveryone) {
      const update = (msgs: ChatMessage[]) => msgs.map(m => m.id === data.messageId ? { ...m, isDeletedForEveryone: true, content: 'This message was deleted' } : m);
      setConversations(prev => prev.map(c => ({ ...c, messages: update(c.messages) })));
      setActiveConv(prev => prev ? { ...prev, messages: update(prev.messages) } : prev);
    }
  }});

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeConv?.messages]);

  // ── Load existing rooms on mount ────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    if (!token) return;
    setLoadingRooms(true);
    try {
      const [roomsRes, usersRes] = await Promise.all([
        apiClient.get('/api/v1/chat/rooms'),
        apiClient.get('/api/v1/chat/users'),
      ]);
      const rooms: any[] = roomsRes.data.rooms || [];
      const allUsers: ChatUser[] = usersRes.data.users || [];
      setUsers(allUsers);

      const convs: Conversation[] = [];
      for (const room of rooms) {
        if (room.type !== 'DIRECT') continue;
        // Backend now returns memberIds array directly
        const memberIds: string[] = room.memberIds || room.members || [];
        const otherMemberId = memberIds.find((id: string) => id !== currentUserId);
        if (!otherMemberId) continue;
        const chatUser = allUsers.find(u => u.id === otherMemberId);
        if (!chatUser) continue;

        // Load messages + unread count in parallel
        const [msgRes, unreadRes] = await Promise.all([
          apiClient.get(`/api/v1/chat/rooms/${room.id}/messages`).catch(() => ({ data: { messages: [] } })),
          apiClient.get(`/api/v1/chat/rooms/${room.id}/unread`).catch(() => ({ data: { unreadCount: 0 } })),
        ]);
        // Backend returns messages newest-first — reverse to chronological order
        const messages: ChatMessage[] = (msgRes.data.messages || []).slice().reverse();
        const unread: number = unreadRes.data.unreadCount || 0;

        convs.push({ roomId: room.id, user: chatUser, messages, unread });
        joinRoom(room.id);
      }
      // Sort conversations by most recent message (newest first in sidebar)
      convs.sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.createdAt || '';
        const bTime = b.messages[b.messages.length - 1]?.createdAt || '';
        return String(bTime).localeCompare(String(aTime));
      });
      setConversations(convs);
    } catch { /* silent */ }
    finally { setLoadingRooms(false); }
  }, [token, currentUserId, joinRoom]);

  useEffect(() => { if (open) loadRooms(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load users list ─────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try { const res = await apiClient.get('/api/v1/chat/users'); setUsers(res.data.users || []); }
    catch { /* silent */ } finally { setLoadingUsers(false); }
  }, []);

  // ── Open DM ─────────────────────────────────────────────────────────────────
  const openDM = useCallback(async (user: ChatUser) => {
    const existing = conversationsRef.current.find(c => c.user.id === user.id);
    if (existing) {
      setActiveConv({ ...existing, unread: 0 });
      setConversations(prev => prev.map(c => c.user.id === user.id ? { ...c, unread: 0 } : c));
      setView('chat'); setDmError(null); return;
    }
    setOpeningDM(user.id); setDmError(null);
    try {
      const res = await apiClient.post('/api/v1/chat/rooms', { type: 'DIRECT', memberIds: [user.id] });
      const roomId: string = res.data.id;
      const msgRes = await apiClient.get(`/api/v1/chat/rooms/${roomId}/messages`);
      const messages: ChatMessage[] = (msgRes.data.messages || []).slice().reverse();
      const conv: Conversation = { roomId, user, messages, unread: 0 };
      setConversations(prev => [conv, ...prev.filter(c => c.user.id !== user.id)]);
      setActiveConv(conv); joinRoom(roomId); setView('chat');
    } catch (err: any) {
      setDmError(err?.response?.data?.error || err?.message || 'Failed to open chat');
    } finally { setOpeningDM(null); }
  }, [joinRoom]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!input.trim() || !activeConvRef.current) return;
    sendMessage(activeConvRef.current.roomId, input.trim());
    // Optimistically add message to UI
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`, roomId: activeConvRef.current.roomId,
      senderId: currentUserId, content: input.trim(),
      fileId: null, createdAt: new Date().toISOString(),
    };
    setActiveConv(prev => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);
    setConversations(prev => prev.map(c =>
      c.roomId === activeConvRef.current?.roomId ? { ...c, messages: [...c.messages, optimistic] } : c
    ));
    setInput('');
  }, [input, currentUserId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Mark messages as read when conversation is opened ───────────────────────
  useEffect(() => {
    if (!activeConv || view !== 'chat') return;
    // Mark all unread messages from the other user as read
    const unreadMsgs = activeConv.messages.filter(
      m => m.senderId !== currentUserId && !(m.readBy || []).includes(currentUserId)
    );
    unreadMsgs.forEach(m => {
      apiClient.post(`/api/v1/chat/rooms/${activeConv.roomId}/messages/${m.id}/read`).catch(() => {});
    });
    if (unreadMsgs.length > 0) {
      // Update local state so ticks update immediately
      setActiveConv(prev => prev ? {
        ...prev,
        messages: prev.messages.map(m =>
          unreadMsgs.find(u => u.id === m.id)
            ? { ...m, readBy: [...(m.readBy || []), currentUserId] }
            : m
        )
      } : prev);
    }
  }, [activeConv?.roomId, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Menu item shared style ───────────────────────────────────────────────────
  const menuItemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 14px', border: 'none', background: 'transparent',
    cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.textPrimary,
    transition: 'background 0.1s',
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  // Unified sidebar search — filters both conversations and users
  const sidebarSearch = convSearch.toLowerCase();
  const filteredConvs = conversations.filter(c =>
    c.user.name.toLowerCase().includes(sidebarSearch)
  );
  // Users not already in a conversation
  const usersWithoutConv = users.filter(u =>
    !conversations.find(c => c.user.id === u.id) &&
    (u.name.toLowerCase().includes(sidebarSearch) ||
     u.email.toLowerCase().includes(sidebarSearch) ||
     u.role.toLowerCase().includes(sidebarSearch))
  );
  // For the middle panel user picker (kept for compat but no longer primary flow)
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  // ── Left panel ───────────────────────────────────────────────────────────────
  const renderLeft = () => (
    <div style={{ width: 240, minWidth: 240, display: 'flex', flexDirection: 'column', background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}`, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Messages</span>
          {totalUnread > 0 && (
            <span style={{ background: C.accent, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
              {totalUnread}
            </span>
          )}
        </div>
      </div>

      {/* Unified search */}
      <SearchBox value={convSearch} onChange={setConvSearch} placeholder="Search people…" />

      {/* Connection dot */}
      <div style={{ padding: '0 14px 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? C.online : '#f87171', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: C.textMuted }}>{connected ? 'Connected' : 'Connecting…'}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingRooms ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 12 }}>Loading…</div>
        ) : (
          <>
            {/* ── Active conversations ── */}
            {filteredConvs.length > 0 && (
              <>
                <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Conversations
                </div>
                {filteredConvs.map(conv => {
                  const isActive = activeConv?.roomId === conv.roomId;
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  return (
                    <button key={conv.roomId}
                      onClick={() => {
                        setActiveConv({ ...conv, unread: 0 });
                        setConversations(prev => prev.map(c => c.roomId === conv.roomId ? { ...c, unread: 0 } : c));
                        setView('chat');
                        apiClient.post(`/api/v1/chat/rooms/${conv.roomId}/read`).catch(() => {});
                      }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: isActive ? C.accentLight : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: isActive ? `3px solid ${C.accent}` : '3px solid transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = '#e8edfc'); }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent'); }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={conv.user.name} photoUrl={conv.user.profilePhotoUrl} size={36} color={portalColor(conv.user.portal)} />
                        <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: conv.user.online ? C.online : C.offline, border: '2px solid ' + C.sidebarBg }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{conv.user.name}</p>
                          {lastMsg && <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: conv.unread > 0 ? C.textPrimary : C.textSecond, fontWeight: conv.unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lastMsg ? lastMsg.content : conv.user.role}
                        </p>
                      </div>
                      {conv.unread > 0 && (
                        <span style={{ background: C.accent, color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {conv.unread > 9 ? '9+' : conv.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* ── All users (not yet in a conversation) ── */}
            {usersWithoutConv.length > 0 && (
              <>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: filteredConvs.length > 0 ? `1px solid ${C.border}` : 'none', marginTop: filteredConvs.length > 0 ? 4 : 0 }}>
                  People
                </div>
                {usersWithoutConv.map(u => {
                  const isLoading = openingDM === u.id;
                  // DEVELOPER non-leaders appear in CTO's list but cannot initiate chat
                  const isReadOnly = u.role === 'DEVELOPER' && !u.isTeamLeader;
                  const roleLabel = u.role === 'DEVELOPER'
                    ? (u.isTeamLeader ? 'Developer · Team Leader' : 'Developer · View only')
                    : u.role.replace(/_/g, ' ');
                  return (
                    <button key={u.id}
                      onClick={() => !openingDM && !isReadOnly && openDM(u)}
                      disabled={!!openingDM || isReadOnly}
                      title={isReadOnly ? 'Non-leader developers cannot initiate chat' : undefined}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: isLoading ? C.accentLight : 'transparent', cursor: isReadOnly ? 'not-allowed' : openingDM ? 'wait' : 'pointer', textAlign: 'left', borderLeft: '3px solid transparent', opacity: isReadOnly ? 0.45 : openingDM && !isLoading ? 0.5 : 1, transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (!openingDM && !isReadOnly) (e.currentTarget.style.background = '#e8edfc'); }}
                      onMouseLeave={e => { if (!openingDM && !isReadOnly) (e.currentTarget.style.background = 'transparent'); }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={u.name} photoUrl={u.profilePhotoUrl} size={36} color={portalColor(u.portal)} />
                        <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: u.online ? C.online : C.offline, border: '2px solid ' + C.sidebarBg }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: isReadOnly ? C.textMuted : C.textSecond, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleLabel}</p>
                      </div>
                      {isLoading
                        ? <svg style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke={C.textMuted} strokeWidth="3" strokeDasharray="40 20" /></svg>
                        : isReadOnly
                          ? <svg width="12" height="12" fill="none" stroke={C.textMuted} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          : u.online && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.online, flexShrink: 0 }} />
                      }
                    </button>
                  );
                })}
              </>
            )}

            {/* Empty state */}
            {filteredConvs.length === 0 && usersWithoutConv.length === 0 && !loadingRooms && (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <svg width="36" height="36" fill="none" stroke={C.textMuted} viewBox="0 0 24 24" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
                  {convSearch ? `No results for "${convSearch}"` : 'No users found'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Middle panel ─────────────────────────────────────────────────────────────
  const renderMiddle = () => {
    if (view === 'users') return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.chatBg, height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setView('list'); setSearch(''); }}
            style={{ background: 'none', border: 'none', color: C.textSecond, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>New Message</span>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email or role…" />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingUsers ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Loading users…</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              {search ? `No users match "${search}"` : 'No other users in the system'}
            </div>
          ) : (
            <>
              {dmError && <div style={{ margin: '8px 14px', padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 12 }}>{dmError}</div>}
              {filteredUsers.map(u => {
                const isLoading = openingDM === u.id;
                return (
                  <button key={u.id} onClick={() => !openingDM && openDM(u)} disabled={!!openingDM}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', border: 'none', background: isLoading ? C.accentLight : 'transparent', cursor: openingDM ? 'wait' : 'pointer', textAlign: 'left', borderBottom: `1px solid ${C.border}`, opacity: openingDM && !isLoading ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!openingDM) (e.currentTarget.style.background = C.accentLight); }}
                    onMouseLeave={e => { if (!openingDM) (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar name={u.name} photoUrl={u.profilePhotoUrl} size={38} color={portalColor(u.portal)} />
                      <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: u.online ? C.online : C.offline, border: '2px solid #fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{u.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: C.textSecond }}>{u.role}</span>
                        {u.portal && <span style={{ padding: '1px 6px', borderRadius: 8, background: portalColor(u.portal), color: '#fff', fontSize: 10 }}>{u.portal}</span>}
                      </div>
                    </div>
                    {isLoading
                      ? <svg style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke={C.textMuted} strokeWidth="3" strokeDasharray="40 20" /></svg>
                      : <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.online ? C.online : C.offline, flexShrink: 0 }} />
                    }
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    );

    // Empty / no active conv — show banner if there are unread messages
    if (view !== 'chat' || !activeConv) return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.chatBg, height: '100%', gap: 16, padding: 24 }}>
        {/* Unread banner — replaces "Start a chat" when there are pending messages */}
        {totalUnread > 0 ? (
          <div style={{ width: '100%', maxWidth: 320 }}>
            <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`, borderRadius: 16, padding: '20px 24px', color: '#fff', textAlign: 'center', boxShadow: '0 8px 24px rgba(79,110,247,0.35)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{totalUnread}</p>
              <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.9 }}>
                {totalUnread === 1 ? 'unread message' : 'unread messages'} waiting
              </p>
              {/* List conversations with unread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conversations.filter(c => c.unread > 0).map(c => (
                  <button key={c.roomId}
                    onClick={() => { setActiveConv({ ...c, unread: 0 }); setConversations(prev => prev.map(x => x.roomId === c.roomId ? { ...x, unread: 0 } : x)); setView('chat'); apiClient.post(`/api/v1/chat/rooms/${c.roomId}/read`).catch(() => {}); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(4px)' }}>
                    <Avatar name={c.user.name} photoUrl={c.user.profilePhotoUrl} size={32} color="rgba(255,255,255,0.3)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{c.user.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.messages[c.messages.length - 1]?.content || 'New message'}
                      </p>
                    </div>
                    <span style={{ background: '#fff', color: C.accent, borderRadius: '50%', width: 20, height: 20, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {c.unread > 9 ? '9+' : c.unread}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <svg width="56" height="56" fill="none" stroke={C.textMuted} viewBox="0 0 24 24" style={{ opacity: 0.25 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>Select a conversation</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>or start a new one</p>
            </div>
            <button onClick={() => { setView('users'); loadUsers(); setSearch(''); }}
              style={{ padding: '8px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(79,110,247,0.3)' }}>
              Start a chat
            </button>
          </>
        )}
      </div>
    );

    // Active chat
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.chatBg, height: '100%', overflow: 'hidden' }}>
        {/* Floating new-message banner */}
        {newMsgBanner && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: C.accent, color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(79,110,247,0.4)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', animation: 'slideDown 0.3s ease' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {newMsgBanner.count} new {newMsgBanner.count === 1 ? 'message' : 'messages'} from {newMsgBanner.name}
          </div>
        )}
        {/* Chat header */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
          <button onClick={() => { setView('list'); setActiveConv(null); setProfileOpen(false); }}
            style={{ background: 'none', border: 'none', color: C.textSecond, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={activeConv.user.name} photoUrl={activeConv.user.profilePhotoUrl} size={36} color={portalColor(activeConv.user.portal)} />
            <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: activeConv.user.online ? C.online : C.offline, border: '2px solid #fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{activeConv.user.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: activeConv.user.online ? C.online : C.textMuted }}>
              {activeConv.user.online ? 'Online' : 'Offline'} · {activeConv.user.role}
            </p>
          </div>
          {/* Profile toggle */}
          <button
            onClick={() => setProfileOpen(o => !o)}
            title={profileOpen ? 'Hide profile' : 'Show profile'}
            style={{ background: profileOpen ? C.accentLight : 'none', border: 'none', color: profileOpen ? C.accent : C.textSecond, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', flexShrink: 0, transition: 'background 0.15s' }}>
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
        {/* Messages — WhatsApp-style tiled background */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
          backgroundColor: '#e8ede8',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8d8c8' fill-opacity='0.45'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
          onClick={() => setMenuMsgId(null)}
        >
          {activeConv.messages.length === 0 && (
            <div style={{ margin: 'auto 0', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: '8px 18px', fontSize: 12, color: '#6b7a6b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                No messages yet. Say hello! 👋
              </div>
            </div>
          )}
          {activeConv.messages.map((msg, idx) => {
            const isMine = msg.senderId === currentUserId;
            const prevMsg = activeConv.messages[idx - 1];
            const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
            const isOptimistic = msg.id.startsWith('opt-');
            const isRead = !isOptimistic && (msg.readBy || []).some((id: string) => id !== currentUserId);
            const isMenuOpen = menuMsgId === msg.id;
            const isDeleted = msg.isDeletedForEveryone;

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: 'center', margin: '6px 0' }}>
                    <span style={{ fontSize: 11, color: '#5a6b5a', background: 'rgba(255,255,255,0.82)', padding: '3px 14px', borderRadius: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                      {new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                <div
                  className="chat-msg-row"
                  style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6, position: 'relative' }}
                >
                  {!isMine && <Avatar name={activeConv.user.name} photoUrl={activeConv.user.profilePhotoUrl} size={28} color={portalColor(activeConv.user.portal)} />}

                  <div style={{ maxWidth: '68%', position: 'relative' }}>
                    {/* Bubble */}
                    <div
                      onContextMenu={e => { e.preventDefault(); setMenuMsgId(isMenuOpen ? null : msg.id); }}
                      style={{
                        padding: isDeleted ? '7px 12px' : '7px 12px 4px',
                        borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isDeleted ? '#f0f0f0' : isMine ? '#dcf8c6' : '#ffffff',
                        color: isDeleted ? '#999' : '#1a1a1a',
                        fontSize: 13, lineHeight: 1.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.13)',
                        opacity: isOptimistic ? 0.7 : 1,
                        cursor: 'context-menu',
                        fontStyle: isDeleted ? 'italic' : 'normal',
                      }}
                    >
                      {isDeleted ? (
                        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          This message was deleted
                        </p>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 2px' }}>{msg.content}</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 10, color: '#7a9a7a' }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMine && (
                              /* Ticks: grey=sending, grey double=sent, blue double=read */
                              <svg width="16" height="11" viewBox="0 0 18 12" fill="none">
                                {isOptimistic ? (
                                  /* Single grey — sending */
                                  <path d="M2 6l4 4L16 2" stroke="#9aa3be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                ) : isRead ? (
                                  /* Double blue — read */
                                  <>
                                    <path d="M1 6l4 4L15 2" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M6 6l4 4" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </>
                                ) : (
                                  /* Double grey — delivered */
                                  <>
                                    <path d="M1 6l4 4L15 2" stroke="#9aa3be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M6 6l4 4" stroke="#9aa3be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </>
                                )}
                              </svg>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Context menu */}
                    {isMenuOpen && !isDeleted && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', zIndex: 50,
                          [isMine ? 'right' : 'left']: 0,
                          top: '100%', marginTop: 4,
                          background: '#fff', borderRadius: 10,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                          border: '1px solid #e4e9f7',
                          minWidth: 180, overflow: 'hidden',
                        }}
                      >
                        {/* Delete for me */}
                        <button
                          onClick={() => {
                            setMenuMsgId(null);
                            setActiveConv(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== msg.id) } : prev);
                            setConversations(prev => prev.map(c => c.roomId === activeConv.roomId ? { ...c, messages: c.messages.filter(m => m.id !== msg.id) } : c));
                            apiClient.delete(`/api/v1/chat/rooms/${activeConv.roomId}/messages/${msg.id}`).catch(() => {});
                          }}
                          style={menuItemStyle}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f7f9ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete for me
                        </button>

                        {/* Delete for everyone — only sender */}
                        {isMine && (
                          <button
                            onClick={() => {
                              setMenuMsgId(null);
                              setActiveConv(prev => prev ? { ...prev, messages: prev.messages.map(m => m.id === msg.id ? { ...m, isDeletedForEveryone: true, content: 'This message was deleted' } : m) } : prev);
                              setConversations(prev => prev.map(c => c.roomId === activeConv.roomId ? { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, isDeletedForEveryone: true, content: 'This message was deleted' } : m) } : c));
                              apiClient.delete(`/api/v1/chat/rooms/${activeConv.roomId}/messages/${msg.id}/everyone`).catch(() => {});
                            }}
                            style={{ ...menuItemStyle, color: '#dc2626' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete for everyone
                          </button>
                        )}

                        {/* Divider + Clear chat */}
                        <div style={{ height: 1, background: '#e4e9f7', margin: '2px 0' }} />
                        <button
                          onClick={() => {
                            setMenuMsgId(null);
                            if (!window.confirm('Clear all messages in this chat?')) return;
                            setActiveConv(prev => prev ? { ...prev, messages: [] } : prev);
                            setConversations(prev => prev.map(c => c.roomId === activeConv.roomId ? { ...c, messages: [] } : c));
                            apiClient.delete(`/api/v1/chat/rooms/${activeConv.roomId}/messages`).catch(() => {});
                          }}
                          style={{ ...menuItemStyle, color: '#dc2626' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          Clear chat
                        </button>
                      </div>
                    )}
                  </div>

                  {isMine && <Avatar name="Me" photoUrl={null} size={28} color={C.accentDark} />}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {/* Input */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Write Something..."
            style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', background: '#f7f9ff', color: C.textPrimary }} />
          <button onClick={handleSend} disabled={!input.trim()}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: input.trim() ? C.accent : C.border, color: '#fff', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s', boxShadow: input.trim() ? '0 2px 8px rgba(79,110,247,0.35)' : 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // ── Right panel — only shown when profileOpen && active chat ────────────────
  const renderRight = () => {
    if (!activeConv || view !== 'chat' || !profileOpen) return null;
    const u = activeConv.user;
    return (
      <div style={{ width: 210, minWidth: 210, background: C.rightBg, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header with collapse button */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>Profile</span>
          <button onClick={() => setProfileOpen(false)}
            title="Close profile"
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 14px' }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Avatar name={u.name} photoUrl={u.profilePhotoUrl} size={64} color={portalColor(u.portal)} />
            <span style={{ position: 'absolute', bottom: 3, right: 3, width: 12, height: 12, borderRadius: '50%', background: u.online ? C.online : C.offline, border: '2px solid ' + C.rightBg }} />
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textPrimary, textAlign: 'center' }}>{u.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSecond, textAlign: 'center' }}>{u.role}</p>
          {u.portal && (
            <span style={{ marginTop: 6, padding: '2px 10px', borderRadius: 12, background: portalColor(u.portal), color: '#fff', fontSize: 10, fontWeight: 600 }}>
              {u.portal}
            </span>
          )}
        </div>
        <div style={{ height: 1, background: C.border, margin: '0 16px' }} />
        {/* Info */}
        <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Info</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Position / Role */}
            <div>
              <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Position</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textPrimary, fontWeight: 600 }}>{u.role}</p>
            </div>
            {/* Department */}
            {u.department && (
              <div>
                <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Department</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textPrimary }}>{u.department}</p>
              </div>
            )}
            {/* Portal / Works at */}
            {u.portal && (
              <div>
                <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Works at</p>
                <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 8, background: portalColor(u.portal), color: '#fff', fontSize: 10, fontWeight: 600 }}>{u.portal}</span>
              </div>
            )}
            {/* Email */}
            <div>
              <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Email</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textPrimary, wordBreak: 'break-all' }}>{u.email}</p>
            </div>
            {/* Status */}
            <div>
              <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.online ? C.online : C.offline }} />
                <span style={{ fontSize: 11, color: u.online ? C.online : C.textMuted }}>{u.online ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const panelContent = (
    <div style={{ display: 'flex', height: '100%', width: '100%', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .chat-msg-row:hover .chat-del-btn { opacity: 1 !important; }
      `}</style>
      {renderLeft()}
      {renderMiddle()}
      {renderRight()}
    </div>
  );

  if (inlineMode) {
    return (
      <div style={{ display: 'flex', height: '100%', width: '100%', border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(79,110,247,0.08)' }}>
        {panelContent}
      </div>
    );
  }

  // Floating mode
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .chat-msg-row:hover .chat-del-btn { opacity: 1 !important; }
      `}</style>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open chat"
          style={{ width: 52, height: 52, borderRadius: '50%', background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(79,110,247,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {totalUnread > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}
      {open && (
        <div style={{ width: 720, height: 520, background: '#fff', borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.16)', display: 'flex', overflow: 'hidden', border: `1px solid ${C.border}`, position: 'relative' }}>
          <button onClick={() => { setOpen(false); setView('list'); }}
            style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {panelContent}
        </div>
      )}
    </div>
  );
}
