import { useEffect, useState } from 'react'
import type { ChatMessage } from './api'
import { chatsApi } from './chatsApi'

// A conversation. For logged-in users it lives on the server (synced across
// devices, private to the owner); for guests it stays in localStorage only.
export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

const keyFor = (u: string) => `tark_chats_${u}`
const activeKeyFor = (u: string) => `tark_active_${u}`

function loadLocal(u: string): Chat[] {
  try {
    const raw = localStorage.getItem(keyFor(u))
    const list = raw ? (JSON.parse(raw) as Chat[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.trim() ?? ''
  if (!first) return 'New chat'
  return first.length > 42 ? `${first.slice(0, 42)}…` : first
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

export interface Restore {
  id: string
  messages: ChatMessage[]
}

export function useChats(userKey: string, token: string | null) {
  const [chats, setChats] = useState<Chat[]>(() =>
    token ? [] : loadLocal(userKey),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  // Set once per load with the last-open chat, so the app can reopen it.
  const [restore, setRestore] = useState<Restore | null>(null)

  // Load the list on user/token change, then restore the last-open conversation.
  useEffect(() => {
    let cancelled = false
    // Capture the saved active id NOW, before the persist effect can clear it.
    const savedActive = (() => {
      try {
        return localStorage.getItem(activeKeyFor(userKey))
      } catch {
        return null
      }
    })()
    setActiveId(null)
    setRestore(null)

    void (async () => {
      const list: Chat[] = token
        ? (await chatsApi.list(token)).map((m) => ({
            id: m.id,
            title: m.title,
            messages: [],
            createdAt: 0,
          }))
        : loadLocal(userKey)
      if (cancelled) return
      setChats(list)

      if (savedActive && list.some((c) => c.id === savedActive)) {
        if (token) {
          const full = await chatsApi.get(token, savedActive)
          if (!cancelled && full) {
            setChats((p) =>
              p.map((c) =>
                c.id === savedActive ? { ...c, messages: full.messages } : c,
              ),
            )
            setRestore({ id: savedActive, messages: full.messages })
          }
        } else {
          const c = list.find((x) => x.id === savedActive)
          if (!cancelled && c) setRestore({ id: c.id, messages: c.messages })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userKey, token])

  // Guests persist the whole list locally; logged-in users persist per-change
  // to the server (see persistChat).
  useEffect(() => {
    if (!token) {
      try {
        localStorage.setItem(keyFor(userKey), JSON.stringify(chats))
      } catch {
        /* storage full — ignore */
      }
    }
  }, [chats, token, userKey])

  // Remember which chat is open so a refresh reopens it.
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(activeKeyFor(userKey), activeId)
      else localStorage.removeItem(activeKeyFor(userKey))
    } catch {
      /* ignore */
    }
  }, [activeId, userKey])

  // Server chats load their messages lazily the first time they're opened.
  async function ensureMessages(id: string): Promise<ChatMessage[]> {
    const c = chats.find((x) => x.id === id)
    if (!c) return []
    if (!token || c.messages.length) return c.messages
    const full = await chatsApi.get(token, id)
    const msgs = full?.messages ?? []
    setChats((p) => p.map((x) => (x.id === id ? { ...x, messages: msgs } : x)))
    return msgs
  }

  function createChat(id: string, initialTitle?: string) {
    setChats((p) => [
      { id, title: initialTitle || 'New chat', messages: [], createdAt: Date.now() },
      ...p,
    ])
  }

  function persistChat(id: string, messages: ChatMessage[]) {
    setChats((p) =>
      p.map((c) =>
        c.id === id
          ? {
              ...c,
              messages,
              title: c.title === 'New chat' ? deriveTitle(messages) : c.title,
            }
          : c,
      ),
    )
    if (token) {
      const existing = chats.find((c) => c.id === id)
      const title =
        existing && existing.title !== 'New chat'
          ? existing.title
          : deriveTitle(messages)
      void chatsApi.put(token, id, title, messages)
    }
  }

  function deleteChat(id: string) {
    setChats((p) => p.filter((c) => c.id !== id))
    if (token) void chatsApi.remove(token, id)
  }

  return {
    chats,
    activeId,
    setActiveId,
    restore,
    createChat,
    persistChat,
    deleteChat,
    ensureMessages,
    newId,
  }
}
