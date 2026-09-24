/**
 * socialApi.ts: Client API and WebSocket connection for Tark Study Friends and Doubt Circles.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface UserSearchResult {
  id: number
  username: string
  board: string | null
  grade: string | null
  school: string | null
  friendship_status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'declined' | 'blocked'
  is_online?: boolean
}

export interface Friend {
  id: number
  username: string
  board: string | null
  grade: string | null
  school: string | null
  channel_id: string
  friends_since: number
  is_online?: boolean
}

export interface PendingRequest {
  request_id: number
  created_at: number
  user_id: number
  username: string
  board: string | null
  grade: string | null
  school: string | null
}

export interface SocialChannel {
  id: string
  type: 'direct' | 'group'
  name: string | null
  updated_at: number
  unread_count: number
  last_message: {
    sender_username: string
    content: string
    msg_type: string
    created_at: number
  } | null
  dm_peer: {
    id: number
    username: string
    board: string | null
    grade: string | null
    is_online?: boolean
  } | null
  member_count?: number
}

export interface SocialMessage {
  id: string
  channel_id: string
  sender_id: number
  sender_username: string
  content: string
  msg_type: 'text' | 'doubt_share' | 'image'
  metadata?: {
    subject?: string
    chapter?: string
    equation?: string
    ai_quote?: string
    image_url?: string
    context_note?: string
    [key: string]: any
  } | null
  created_at: number
}

export interface ChannelDetail {
  id: string
  type: 'direct' | 'group'
  name: string | null
  created_by: number
  created_at: number
  updated_at: number
  members: Array<{
    id: number
    username: string
    board: string | null
    grade: string | null
    role: string
    joined_at: number
    is_online?: boolean
  }>
}

async function requestJson<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.detail === 'string' ? data.detail : `Error ${res.status}`,
      }
    }
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' }
  }
}

export const socialApi = {
  searchUsers: (q: string, token: string) =>
    requestJson<{ users: UserSearchResult[] }>(`/social/users/search?q=${encodeURIComponent(q)}`, token),

  sendFriendRequest: (toUserId: number, token: string) =>
    requestJson<{ ok: boolean; status: string }>('/social/friends/request', token, {
      method: 'POST',
      body: JSON.stringify({ to_user_id: toUserId }),
    }),

  respondFriendRequest: (otherUserId: number, accept: boolean, token: string) =>
    requestJson<{ ok: boolean; status: string }>('/social/friends/respond', token, {
      method: 'POST',
      body: JSON.stringify({ other_user_id: otherUserId, accept }),
    }),

  getFriends: (token: string) =>
    requestJson<{ friends: Friend[]; pending: { incoming: PendingRequest[]; outgoing: PendingRequest[] } }>(
      '/social/friends',
      token
    ),

  getChannels: (token: string) =>
    requestJson<{ channels: SocialChannel[] }>('/social/channels', token),

  getOrCreateDirectChannel: (otherUserId: number, token: string) =>
    requestJson<{ ok: boolean; channel_id: string }>('/social/channels/direct', token, {
      method: 'POST',
      body: JSON.stringify({ other_user_id: otherUserId }),
    }),

  createGroupChannel: (name: string, memberIds: number[], token: string) =>
    requestJson<{ ok: boolean; channel_id: string; name: string }>('/social/channels/group', token, {
      method: 'POST',
      body: JSON.stringify({ name, member_ids: memberIds }),
    }),

  getChannel: (channelId: string, token: string) =>
    requestJson<{ channel: ChannelDetail }>(`/social/channels/${channelId}`, token),

  getMessages: (channelId: string, token: string, limit = 50, before?: number) => {
    let url = `/social/channels/${channelId}/messages?limit=${limit}`
    if (before) url += `&before=${before}`
    return requestJson<{ messages: SocialMessage[] }>(url, token)
  },

  sendMessage: (
    channelId: string,
    content: string,
    token: string,
    msgType: 'text' | 'doubt_share' | 'image' = 'text',
    metadata?: any
  ) =>
    requestJson<{ ok: boolean; message: SocialMessage }>(`/social/channels/${channelId}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({ content, msg_type: msgType, metadata }),
    }),

  markRead: (channelId: string, token: string) =>
    requestJson<{ ok: boolean }>(`/social/channels/${channelId}/read`, token, {
      method: 'POST',
    }),

  reportTyping: (channelId: string, token: string) =>
    requestJson<{ ok: boolean }>(`/social/channels/${channelId}/typing`, token, {
      method: 'POST',
    }),
}

/**
 * Real-time WebSocket connection helper with auto-heartbeat and message handler.
 */
export function connectSocialWebSocket(
  token: string,
  callbacks: {
    onMessage: (event: any) => void
    onOpen?: () => void
    onClose?: () => void
  }
) {
  const wsUrl = API_BASE.replace(/^http/, 'ws') + `/social/ws?token=${encodeURIComponent(token)}`
  let ws: WebSocket | null = null
  let pingTimer: any = null
  let isClosedManually = false

  function connect() {
    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        callbacks.onOpen?.()
        // Start ping heartbeat every 25s
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25000)
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          callbacks.onMessage(data)
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        clearInterval(pingTimer)
        callbacks.onClose?.()
        if (!isClosedManually) {
          // Attempt reconnect after 3.5s
          setTimeout(connect, 3500)
        }
      }

      ws.onerror = () => {
        ws?.close()
      }
    } catch {
      // Reconnect fallback
      if (!isClosedManually) {
        setTimeout(connect, 4000)
      }
    }
  }

  connect()

  return {
    sendTyping: (channelId: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', channel_id: channelId }))
      }
    },
    sendRead: (channelId: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'read', channel_id: channelId }))
      }
    },
    close: () => {
      isClosedManually = true
      clearInterval(pingTimer)
      ws?.close()
    },
  }
}
