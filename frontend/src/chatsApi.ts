// Server-side chat history (logged-in users). Guests keep chats in localStorage.
import type { ChatMessage } from './api'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface ChatMeta {
  id: string
  title: string
  updated_at: number
}

const authHeaders = (token: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

export const chatsApi = {
  async list(token: string): Promise<ChatMeta[]> {
    try {
      const res = await fetch(`${API_BASE}/chats`, { headers: authHeaders(token) })
      if (!res.ok) return []
      const data = await res.json()
      return (data.chats ?? []) as ChatMeta[]
    } catch {
      return []
    }
  },
  async get(
    token: string,
    id: string,
  ): Promise<{ id: string; title: string; messages: ChatMessage[] } | null> {
    try {
      const res = await fetch(`${API_BASE}/chats/${id}`, {
        headers: authHeaders(token),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },
  async put(
    token: string,
    id: string,
    title: string,
    messages: ChatMessage[],
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/chats/${id}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ title, messages }),
      })
      return res.ok
    } catch {
      return false
    }
  },
  async remove(token: string, id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/chats/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
    } catch {
      /* ignore */
    }
  },
}
