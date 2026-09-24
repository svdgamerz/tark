import React, { useEffect, useRef, useState } from 'react'
import {
  socialApi,
  connectSocialWebSocket,
  type Friend,
  type PendingRequest,
  type SocialChannel,
  type SocialMessage,
  type UserSearchResult,
  type ChannelDetail,
} from '../socialApi'
import { parseSegments, renderMath } from '../math'
import type { AuthUser } from '../authApi'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string | null
  currentUser: AuthUser | null
  initialChannelId?: string | null
  onUnreadCountChange?: (count: number) => void
  onRequireLogin?: () => void
}

export function FriendsDrawer({
  isOpen,
  onClose,
  token,
  currentUser,
  initialChannelId,
  onUnreadCountChange,
  onRequireLogin,
}: Props) {
  // Navigation & Tabs
  const [tab, setTab] = useState<'chats' | 'friends'>('chats')
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)

  // Data lists
  const [channels, setChannels] = useState<SocialChannel[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [pending, setPending] = useState<{ incoming: PendingRequest[]; outgoing: PendingRequest[] }>({
    incoming: [],
    outgoing: [],
  })

  // Action busy states by target user id: 'sending' | 'accepting' | 'declining'
  const [actionInProgress, setActionInProgress] = useState<Record<number, string>>({})

  // Active channel messages & details
  const [activeChannel, setActiveChannel] = useState<ChannelDetail | null>(null)
  const [messages, setMessages] = useState<SocialMessage[]>([])
  const [inputContent, setInputContent] = useState('')
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<{ [channelId: string]: string }>({})

  // User search & group creation
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Math Tools state
  const [showMathPalette, setShowMathPalette] = useState(false)
  const [mathTab, setMathTab] = useState<'templates' | 'symbols' | 'greek' | 'advanced'>('templates')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Group creation modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<number[]>([])
  const [groupError, setGroupError] = useState<string | null>(null)

  // Status
  const [wsClient, setWsClient] = useState<{
    sendTyping: (cid: string) => void
    sendRead: (cid: string) => void
    close: () => void
  } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<any>(null)

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ---------------------------------------------------------------------------
  // WebSocket Setup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!token || !isOpen) return

    const client = connectSocialWebSocket(token, {
      onMessage: (data) => {
        if (data.type === 'new_message') {
          const newMsg: SocialMessage = data.message
          // If message is in active channel, add to messages list and mark read
          if (newMsg.channel_id === activeChannelId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              // Deduplicate against optimistic temp message from same sender
              if (newMsg.sender_id === currentUser?.id) {
                const tempIndex = prev.findIndex(
                  (m) => m.id.startsWith('temp_') && m.content === newMsg.content
                )
                if (tempIndex !== -1) {
                  const updated = [...prev]
                  updated[tempIndex] = newMsg
                  return updated
                }
              }
              return [...prev, newMsg]
            })
            socialApi.markRead(newMsg.channel_id, token)
            setTimeout(scrollToBottom, 50)
          }

          // Update channels list unread count & last message
          setChannels((prev) =>
            prev.map((c) => {
              if (c.id === newMsg.channel_id) {
                const isCurrentlyViewing = c.id === activeChannelId
                return {
                  ...c,
                  updated_at: newMsg.created_at,
                  unread_count: isCurrentlyViewing ? 0 : c.unread_count + 1,
                  last_message: {
                    sender_username: newMsg.sender_username,
                    content: newMsg.content,
                    msg_type: newMsg.msg_type,
                    created_at: newMsg.created_at,
                  },
                }
              }
              return c
            })
          )
        } else if (data.type === 'typing') {
          // Show typing indicator for 3 seconds
          setTypingUsers((prev) => ({
            ...prev,
            [data.channel_id]: data.username,
          }))
          setTimeout(() => {
            setTypingUsers((prev) => {
              const copy = { ...prev }
              if (copy[data.channel_id] === data.username) {
                delete copy[data.channel_id]
              }
              return copy
            })
          }, 3000)
        } else if (data.type === 'presence') {
          // Update online presence indicator in friends and channels
          setFriends((prev) =>
            prev.map((f) => (f.id === data.user_id ? { ...f, is_online: data.status === 'online' } : f))
          )
          setChannels((prev) =>
            prev.map((c) => {
              if (c.dm_peer && c.dm_peer.id === data.user_id) {
                return { ...c, dm_peer: { ...c.dm_peer, is_online: data.status === 'online' } }
              }
              return c
            })
          )
        } else if (data.type === 'friend_request_update' || data.type === 'friend_response_update') {
          // Refresh friends list
          refreshFriends()
        }
      },
    })

    setWsClient(client)

    return () => {
      client.close()
    }
  }, [token, isOpen, activeChannelId])

  // ---------------------------------------------------------------------------
  // Data Loaders
  // ---------------------------------------------------------------------------
  const refreshChannels = async () => {
    if (!token) return
    const res = await socialApi.getChannels(token)
    if (res.ok && res.data) {
      setChannels(res.data.channels)
      const totalUnread = res.data.channels.reduce((sum, c) => sum + c.unread_count, 0)
      onUnreadCountChange?.(totalUnread)
    }
  }

  const refreshFriends = async () => {
    if (!token) return
    const res = await socialApi.getFriends(token)
    if (res.ok && res.data) {
      setFriends(res.data.friends)
      setPending(res.data.pending)
    }
  }

  useEffect(() => {
    if (isOpen && token) {
      Promise.all([refreshChannels(), refreshFriends()])
    }
  }, [isOpen, token])

  // Handle external initialChannelId (e.g. from ShareDoubtModal)
  useEffect(() => {
    if (initialChannelId && isOpen) {
      handleOpenChannel(initialChannelId)
    }
  }, [initialChannelId, isOpen])

  // ---------------------------------------------------------------------------
  // Channel Interaction
  // ---------------------------------------------------------------------------
  const handleOpenChannel = async (channelId: string) => {
    if (!token) return
    setActiveChannelId(channelId)
    setTab('chats')

    // Mark channel read
    socialApi.markRead(channelId, token)
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, unread_count: 0 } : c))
    )

    const [msgRes, chanRes] = await Promise.all([
      socialApi.getMessages(channelId, token),
      socialApi.getChannel(channelId, token),
    ])

    if (msgRes.ok && msgRes.data) {
      setMessages(msgRes.data.messages)
      setTimeout(scrollToBottom, 60)
    }
    if (chanRes.ok && chanRes.data) {
      setActiveChannel(chanRes.data.channel)
    }
  }

  const handleStartDirectChat = async (friendId: number) => {
    if (!token) return
    const res = await socialApi.getOrCreateDirectChannel(friendId, token)
    if (res.ok && res.data) {
      await refreshChannels()
      handleOpenChannel(res.data.channel_id)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !activeChannelId) return
    const content = inputContent.trim()
    if (!content && !attachedImage) return

    const msgType = attachedImage ? 'image' : 'text'
    const metadata = attachedImage ? { image_url: attachedImage } : undefined

    // Optimistic message append
    const tempId = `temp_${Date.now()}`
    const optMsg: SocialMessage = {
      id: tempId,
      channel_id: activeChannelId,
      sender_id: currentUser?.id || 0,
      sender_username: currentUser?.username || 'You',
      content: content || 'Shared an image',
      msg_type: msgType,
      metadata,
      created_at: Date.now() / 1000,
    }

    setMessages((prev) => [...prev, optMsg])
    setInputContent('')
    setAttachedImage(null)
    setTimeout(scrollToBottom, 40)

    const res = await socialApi.sendMessage(activeChannelId, optMsg.content, token, msgType, metadata)
    if (res.ok && res.data) {
      setMessages((prev) => {
        // If WebSocket already inserted the confirmed message, filter out the temporary one
        if (prev.some((m) => m.id === res.data!.message.id)) {
          return prev.filter((m) => m.id !== tempId)
        }
        return prev.map((m) => (m.id === tempId ? res.data!.message : m))
      })
      refreshChannels()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputContent(e.target.value)

    // Send typing notification
    if (activeChannelId && wsClient) {
      if (!typingTimeoutRef.current) {
        wsClient.sendTyping(activeChannelId)
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = null
        }, 2000)
      }
    }
  }

  // Math categories and snippets for students
  const mathTemplates = [
    { label: 'Fraction', tex: '\\frac{a}{b}', display: '\\frac{a}{b}' },
    { label: 'Square', tex: 'x^2', display: 'x^2' },
    { label: 'Cube', tex: 'x^3', display: 'x^3' },
    { label: 'Power n', tex: 'x^{n}', display: 'x^n' },
    { label: 'Subscript', tex: 'x_{1}', display: 'x_1' },
    { label: 'Sqrt', tex: '\\sqrt{x}', display: '\\sqrt{x}' },
    { label: 'N-th Root', tex: '\\sqrt[n]{x}', display: '\\sqrt[n]{x}' },
    { label: 'Parentheses', tex: '(x)', display: '(x)' },
    { label: 'Absolute', tex: '|x|', display: '|x|' },
    { label: 'Exponential', tex: 'e^{x}', display: 'e^x' },
  ]

  const mathSymbols = [
    { label: 'Plus-Minus', tex: '\\pm ', display: '\\pm' },
    { label: 'Multiply', tex: '\\times ', display: '\\times' },
    { label: 'Divide', tex: '\\div ', display: '\\div' },
    { label: 'Less/Equal', tex: '\\le ', display: '\\le' },
    { label: 'Greater/Equal', tex: '\\ge ', display: '\\ge' },
    { label: 'Not Equal', tex: '\\ne ', display: '\\ne' },
    { label: 'Approx', tex: '\\approx ', display: '\\approx' },
    { label: 'Infinity', tex: '\\infty ', display: '\\infty' },
    { label: 'Degree', tex: '^{\\circ}', display: '30^\\circ' },
    { label: 'Arrow Right', tex: '\\rightarrow ', display: '\\rightarrow' },
    { label: 'Therefore', tex: '\\therefore ', display: '\\therefore' },
    { label: 'Because', tex: '\\because ', display: '\\because' },
  ]

  const mathGreek = [
    { label: 'Pi', tex: '\\pi ', display: '\\pi' },
    { label: 'Theta', tex: '\\theta ', display: '\\theta' },
    { label: 'Alpha', tex: '\\alpha ', display: '\\alpha' },
    { label: 'Beta', tex: '\\beta ', display: '\\beta' },
    { label: 'Gamma', tex: '\\gamma ', display: '\\gamma' },
    { label: 'Delta', tex: '\\Delta ', display: '\\Delta' },
    { label: 'Lambda', tex: '\\lambda ', display: '\\lambda' },
    { label: 'Omega', tex: '\\omega ', display: '\\omega' },
    { label: 'Sigma', tex: '\\sigma ', display: '\\sigma' },
    { label: 'Mu', tex: '\\mu ', display: '\\mu' },
  ]

  const mathAdvanced = [
    { label: 'Sin', tex: '\\sin(x) ', display: '\\sin(x)' },
    { label: 'Cos', tex: '\\cos(x) ', display: '\\cos(x)' },
    { label: 'Tan', tex: '\\tan(x) ', display: '\\tan(x)' },
    { label: 'Log', tex: '\\log_{10}(x) ', display: '\\log(x)' },
    { label: 'Natural Log', tex: '\\ln(x) ', display: '\\ln(x)' },
    { label: 'Summation', tex: '\\sum_{i=1}^{n} ', display: '\\sum_{i=1}^n' },
    { label: 'Integral', tex: '\\int_{a}^{b} f(x)dx ', display: '\\int_a^b' },
    { label: 'Limit', tex: '\\lim_{x \\to 0} ', display: '\\lim_{x\\to 0}' },
    { label: 'Vector', tex: '\\vec{v} ', display: '\\vec{v}' },
  ]

  // Insert formula snippet at cursor or wrap with $...$
  const insertMathSnippet = (snippet: string) => {
    const textarea = textareaRef.current
    const prev = inputContent

    let newContent = ''
    let newCursor = 0

    if (textarea) {
      const start = textarea.selectionStart ?? prev.length
      const end = textarea.selectionEnd ?? prev.length

      const before = prev.substring(0, start)
      const selected = prev.substring(start, end)
      const after = prev.substring(end)

      // Count unescaped dollar signs before cursor
      const dollarsBefore = (before.match(/(?<!\\)\$/g) || []).length
      const isInsideMath = dollarsBefore % 2 === 1

      if (isInsideMath) {
        // Already inside math context
        newContent = before + (selected ? snippet.replace('x', selected) : snippet) + after
        newCursor = start + (selected ? snippet.replace('x', selected) : snippet).length
      } else {
        // Outside math context - wrap with $...$
        const inner = selected ? snippet.replace('x', selected) : snippet
        const wrapped = `$${inner}$`
        const prefix = before.length > 0 && !before.endsWith(' ') ? ' ' : ''
        const suffix = after.length > 0 && !after.startsWith(' ') ? ' ' : ''
        newContent = before + prefix + wrapped + suffix + after
        newCursor = (before + prefix + wrapped).length
      }
    } else {
      newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + `$${snippet}$ `
      newCursor = newContent.length
    }

    setInputContent(newContent)

    setTimeout(() => {
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(newCursor, newCursor)
      }
    }, 10)
  }

  // Quick formula button: toggle palette or insert default
  const handleToggleMathPalette = () => {
    setShowMathPalette((prev) => !prev)
  }

  // Handle photo attachment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAttachedImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // ---------------------------------------------------------------------------
  // User Search & Friend Requests
  // ---------------------------------------------------------------------------
  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !searchQuery.trim()) return
    setIsSearching(true)
    setSearchError(null)

    const res = await socialApi.searchUsers(searchQuery.trim(), token)
    if (res.ok && res.data) {
      setSearchResults(res.data.users)
      if (res.data.users.length === 0) {
        setSearchError('No students found with that username.')
      }
    } else {
      setSearchError(res.error || 'Failed to search students.')
    }
    setIsSearching(false)
  }

  const handleSendFriendRequest = async (userId: number) => {
    if (!token) {
      if (onRequireLogin) onRequireLogin()
      else alert('Please sign in to add study friends.')
      return
    }
    setActionInProgress((prev) => ({ ...prev, [userId]: 'sending' }))
    try {
      const res = await socialApi.sendFriendRequest(userId, token)
      if (res.ok) {
        setSearchResults((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, friendship_status: 'pending_sent' } : u))
        )
        await refreshFriends()
      } else {
        alert(res.error || 'Unable to send friend request')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to send friend request')
    } finally {
      setActionInProgress((prev) => {
        const copy = { ...prev }
        delete copy[userId]
        return copy
      })
    }
  }

  const handleRespondRequest = async (userId: number, accept: boolean) => {
    if (!token) {
      if (onRequireLogin) onRequireLogin()
      else alert('Please sign in to respond to friend requests.')
      return
    }
    const actionKey = accept ? 'accepting' : 'declining'
    setActionInProgress((prev) => ({ ...prev, [userId]: actionKey }))
    try {
      const res = await socialApi.respondFriendRequest(userId, accept, token)
      if (res.ok) {
        // Optimistically remove from incoming pending requests
        setPending((prev) => ({
          ...prev,
          incoming: prev.incoming.filter((p) => p.user_id !== userId),
        }))
        // Update status in search results if user was searched
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, friendship_status: accept ? 'friends' : 'none' } : u
          )
        )
        await refreshFriends()
        await refreshChannels()
      } else {
        alert(res.error || 'Failed to process friend request')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to respond to friend request')
    } finally {
      setActionInProgress((prev) => {
        const copy = { ...prev }
        delete copy[userId]
        return copy
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Create Group Circle
  // ---------------------------------------------------------------------------
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newGroupName.trim()) return
    if (selectedGroupMembers.length === 0) {
      setGroupError('Please select at least one classmate to add to this study circle.')
      return
    }

    const res = await socialApi.createGroupChannel(newGroupName.trim(), selectedGroupMembers, token)
    if (res.ok && res.data) {
      setShowCreateGroup(false)
      setNewGroupName('')
      setSelectedGroupMembers([])
      setGroupError(null)
      await refreshChannels()
      handleOpenChannel(res.data.channel_id)
    } else {
      setGroupError(res.error || 'Could not create study circle.')
    }
  }

  if (!isOpen) return null

  // Calculate total unread
  const totalUnreadCount = channels.reduce((sum, c) => sum + c.unread_count, 0)
  const incomingPendingCount = pending.incoming.length

  return (
    <div className="friends-drawer-backdrop" onClick={onClose}>
      <div className="friends-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* ===================================================================
            DRAWER HEADER
           =================================================================== */}
        <div className="friends-drawer-header">
          {activeChannelId ? (
            <div className="fd-header-active-chan">
              <button
                className="fd-back-btn"
                onClick={() => {
                  setActiveChannelId(null)
                  refreshChannels()
                }}
                title="Back to Conversations"
                aria-label="Back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div className="fd-active-avatar">
                {activeChannel?.type === 'group' ? (
                  <span className="fd-avatar-badge group">👥</span>
                ) : (
                  <span className="fd-avatar-badge user">
                    {(activeChannel?.members.find((m) => m.id !== currentUser?.id)?.username || 'U')[0].toUpperCase()}
                  </span>
                )}
                {activeChannel?.type === 'direct' &&
                  activeChannel.members.find((m) => m.id !== currentUser?.id)?.is_online && (
                    <span className="online-indicator-dot" title="Online now" />
                  )}
              </div>
              <div className="fd-active-info">
                <div className="fd-active-title-row">
                  <h4>
                    {activeChannel?.type === 'group'
                      ? activeChannel.name
                      : activeChannel?.members.find((m) => m.id !== currentUser?.id)?.username || 'Classmate'}
                  </h4>
                </div>
                <span className="fd-active-sub">
                  {typingUsers[activeChannelId] ? (
                    <span className="fd-typing-indicator">
                      <em>{typingUsers[activeChannelId]} is typing...</em>
                    </span>
                  ) : activeChannel?.type === 'group' ? (
                    `${activeChannel.members.length} members • Study Circle`
                  ) : (
                    (() => {
                      const peer = activeChannel?.members.find((m) => m.id !== currentUser?.id)
                      return peer?.grade ? `Class ${peer.grade} • ${peer.board || 'Student'}` : 'Peer Student'
                    })()
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="fd-header-main">
              <div className="fd-brand">
                <div className="fd-brand-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="fd-brand-text">
                  <h3>Study Network</h3>
                  <span className="fd-brand-sub">Classmates &amp; doubt circles</span>
                </div>
              </div>
              <div className="fd-tabs">
                <button
                  className={`fd-tab-btn ${tab === 'chats' ? 'active' : ''}`}
                  onClick={() => setTab('chats')}
                >
                  Chats
                  {totalUnreadCount > 0 && <span className="fd-badge">{totalUnreadCount}</span>}
                </button>
                <button
                  className={`fd-tab-btn ${tab === 'friends' ? 'active' : ''}`}
                  onClick={() => setTab('friends')}
                >
                  Classmates
                  {incomingPendingCount > 0 && <span className="fd-badge red">{incomingPendingCount}</span>}
                </button>
              </div>
            </div>
          )}

          <button className="icon-btn fd-close-btn" onClick={onClose} title="Close drawer" aria-label="Close drawer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ===================================================================
            DRAWER BODY
           =================================================================== */}
        <div className="friends-drawer-body">
          {!token || !currentUser ? (
            <div className="fd-empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <span className="fd-empty-icon" style={{ fontSize: '42px', display: 'block', marginBottom: 12 }}>🔒</span>
              <h4 style={{ margin: '0 0 8px' }}>Sign in to connect</h4>
              <p style={{ margin: '0 0 20px', color: 'var(--text-dim, #888)', fontSize: '0.9rem' }}>
                Please sign in or create an account to search classmates, send friend requests, and chat in doubt circles.
              </p>
              <button
                type="button"
                className="tw-btn-primary"
                onClick={() => {
                  onClose()
                  if (onRequireLogin) onRequireLogin()
                }}
              >
                Sign In / Register
              </button>
            </div>
          ) : activeChannelId ? (
            <div className="fd-chat-view">
              <div className="fd-messages-list">
                {messages.length === 0 ? (
                  <div className="fd-messages-empty">
                    <span>👋</span>
                    <p>No messages yet. Say hello or share a study doubt to get started!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === currentUser?.id
                    const segments = parseSegments(m.content)

                    return (
                      <div key={m.id} className={`fd-msg-row ${isMe ? 'me' : 'them'}`}>
                        {!isMe && activeChannel?.type === 'group' && (
                          <span className="fd-msg-sender">{m.sender_username}</span>
                        )}

                        <div className={`fd-msg-bubble ${m.msg_type === 'doubt_share' ? 'doubt' : ''}`}>
                          {/* Rich Doubt Share Card */}
                          {m.msg_type === 'doubt_share' && m.metadata && (
                            <div className="fd-shared-doubt-box">
                              <div className="fd-sdb-header">
                                <span className="fd-sdb-badge">📚 {m.metadata.subject || 'Doubt'}</span>
                                {m.metadata.chapter && (
                                  <span className="fd-sdb-chapter">{m.metadata.chapter}</span>
                                )}
                              </div>

                              {m.metadata.equation && (
                                <div
                                  className="fd-sdb-math"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMath(m.metadata.equation, true),
                                  }}
                                />
                              )}

                              {m.metadata.ai_quote && (
                                <blockquote className="fd-sdb-quote">
                                  {m.metadata.ai_quote}
                                </blockquote>
                              )}
                            </div>
                          )}

                          {/* Image Attachment */}
                          {m.metadata?.image_url && (
                            <div className="fd-msg-image-wrap">
                              <img src={m.metadata.image_url} alt="Study problem" />
                            </div>
                          )}

                          {/* Message Text with KaTeX Formula Rendering */}
                          <div className="fd-msg-text">
                            {segments.map((seg, idx) => {
                              if (seg.type === 'math') {
                                const html = renderMath(seg.value, seg.display)
                                return (
                                  <span
                                    key={idx}
                                    dangerouslySetInnerHTML={{ __html: html }}
                                    className={seg.display ? 'block-math' : 'inline-math'}
                                  />
                                )
                              }
                              return <span key={idx}>{seg.value}</span>
                            })}
                          </div>

                          <span className="fd-msg-time">
                            {new Date(m.created_at * 1000).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="fd-chat-input-area">
                {attachedImage && (
                  <div className="fd-attachment-preview">
                    <img src={attachedImage} alt="Attachment" />
                    <button
                      className="fd-remove-att-btn"
                      onClick={() => setAttachedImage(null)}
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Quick study helpers bar */}
                <div className="fd-chat-quick-bar">
                  <button
                    type="button"
                    className="fd-quick-chip"
                    onClick={() => {
                      setInputContent((prev) => (prev ? `${prev} **Doubt:** ` : '**Doubt:** '))
                    }}
                    title="Insert Doubt prefix"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.5 6h7c2-1.3 3.5-3.5 3.5-6a7 7 0 0 0-7-7z" />
                    </svg>
                    <span>Ask Doubt</span>
                  </button>

                  <button
                    type="button"
                    className={`fd-quick-chip ${showMathPalette ? 'active' : ''}`}
                    onClick={handleToggleMathPalette}
                    title="Open visual Math keyboard with powers, fractions, and symbols"
                  >
                    <span className="fd-chip-math">∑</span>
                    <span>Math Tools {showMathPalette ? '▲' : '▼'}</span>
                  </button>

                  <button
                    type="button"
                    className="fd-quick-chip"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload diagram or textbook problem"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Attach Photo</span>
                  </button>
                </div>

                {/* Visual Math Symbols & Formula Keyboard Palette */}
                {showMathPalette && (
                  <div className="fd-math-palette">
                    <div className="fd-math-palette-tabs">
                      <button
                        type="button"
                        className={`fd-mp-tab ${mathTab === 'templates' ? 'active' : ''}`}
                        onClick={() => setMathTab('templates')}
                      >
                        Templates
                      </button>
                      <button
                        type="button"
                        className={`fd-mp-tab ${mathTab === 'symbols' ? 'active' : ''}`}
                        onClick={() => setMathTab('symbols')}
                      >
                        Symbols
                      </button>
                      <button
                        type="button"
                        className={`fd-mp-tab ${mathTab === 'greek' ? 'active' : ''}`}
                        onClick={() => setMathTab('greek')}
                      >
                        Greek
                      </button>
                      <button
                        type="button"
                        className={`fd-mp-tab ${mathTab === 'advanced' ? 'active' : ''}`}
                        onClick={() => setMathTab('advanced')}
                      >
                        Functions
                      </button>
                      <button
                        type="button"
                        className="fd-mp-close"
                        onClick={() => setShowMathPalette(false)}
                        title="Close math palette"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="fd-math-palette-grid">
                      {(mathTab === 'templates'
                        ? mathTemplates
                        : mathTab === 'symbols'
                        ? mathSymbols
                        : mathTab === 'greek'
                        ? mathGreek
                        : mathAdvanced
                      ).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="fd-math-item-btn"
                          onClick={() => insertMathSnippet(item.tex)}
                          title={`Insert ${item.label}`}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: renderMath(item.display, false),
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Math Formula Preview */}
                {inputContent.includes('$') && (
                  <div className="fd-math-live-preview">
                    <div className="fd-preview-header">
                      <span className="fd-preview-title">📐 Live Formula Preview:</span>
                    </div>
                    <div className="fd-preview-body">
                      {parseSegments(inputContent).map((seg, idx) => {
                        if (seg.type === 'math') {
                          return (
                            <span
                              key={idx}
                              dangerouslySetInnerHTML={{ __html: renderMath(seg.value, seg.display) }}
                              className={seg.display ? 'block-math' : 'inline-math'}
                            />
                          )
                        }
                        return <span key={idx}>{seg.value}</span>
                      })}
                    </div>
                  </div>
                )}

                <form className="fd-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileSelect}
                  />

                  <div className="fd-input-box-wrapper">
                    <div className="fd-input-tools-left">
                      <button
                        type="button"
                        className="fd-tool-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach problem photo or diagram"
                        aria-label="Attach photo"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className={`fd-tool-btn math-btn ${showMathPalette ? 'active' : ''}`}
                        onClick={handleToggleMathPalette}
                        title="Toggle Math Keyboard ($x^2$, fractions, roots)"
                        aria-label="Toggle math keyboard"
                      >
                        <span className="fd-math-glyph">∑</span>
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      className="fd-textarea"
                      rows={1}
                      value={inputContent}
                      placeholder="Type a message or doubt ($x^2$, fractions supported)..."
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />

                    <button
                      type="submit"
                      className="fd-send-btn"
                      disabled={!inputContent.trim() && !attachedImage}
                      title="Send message"
                      aria-label="Send message"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : tab === 'chats' ? (
            /* -----------------------------------------------------------------
                VIEW 2: CHANNELS LIST (TAB 1)
               ----------------------------------------------------------------- */
            <div className="fd-channels-view">
              <div className="fd-channels-action-bar">
                <button
                  className="fd-new-group-btn"
                  onClick={() => setShowCreateGroup(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Study Circle
                </button>
              </div>

              {channels.length === 0 ? (
                <div className="fd-empty-state">
                  <span className="fd-empty-icon">👥</span>
                  <h4>No active chats</h4>
                  <p>
                    Switch to the <strong>Classmates</strong> tab to connect or start a new Study Circle!
                  </p>
                  <button className="tw-btn-primary" onClick={() => setTab('friends')}>
                    Find Classmates
                  </button>
                </div>
              ) : (
                <div className="fd-channels-list">
                  {channels.map((c) => {
                    const title =
                      c.type === 'group'
                        ? c.name
                        : c.dm_peer?.username || 'Classmate'
                    const isOnline = c.type === 'direct' && c.dm_peer?.is_online

                    return (
                      <div
                        key={c.id}
                        className="fd-channel-card"
                        onClick={() => handleOpenChannel(c.id)}
                      >
                        <div className="fd-chan-avatar">
                          {c.type === 'group' ? (
                            <span className="fd-avatar-badge group">👥</span>
                          ) : (
                            <span className="fd-avatar-initial">
                              {(c.dm_peer?.username || 'U')[0].toUpperCase()}
                            </span>
                          )}
                          {isOnline && <span className="avatar-online-dot" />}
                        </div>

                        <div className="fd-chan-info">
                          <div className="fd-chan-top-row">
                            <h5 className="fd-chan-title">{title}</h5>
                            {c.last_message && (
                              <span className="fd-chan-time">
                                {new Date(c.updated_at * 1000).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <div className="fd-chan-bottom-row">
                            <p className="fd-chan-preview">
                              {typingUsers[c.id] ? (
                                <em className="fd-typing-text">{typingUsers[c.id]} is typing...</em>
                              ) : c.last_message ? (
                                `${c.last_message.sender_username}: ${c.last_message.content}`
                              ) : (
                                <em>Tap to start conversation</em>
                              )}
                            </p>
                            {c.unread_count > 0 && (
                              <span className="fd-unread-badge">{c.unread_count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* -----------------------------------------------------------------
                VIEW 3: FRIENDS HUB & USER SEARCH (TAB 2)
               ----------------------------------------------------------------- */
            <div className="fd-friends-view">
              {/* Search bar to find classmates */}
              <form className="fd-search-bar" onSubmit={handleSearchUsers}>
                <input
                  type="text"
                  className="tw-input"
                  placeholder="Find classmates by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="tw-btn-primary" disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? '...' : 'Search'}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="fd-section">
                  <h5 className="fd-section-title">Search Results</h5>
                  <div className="fd-cards-list">
                    {searchResults.map((u) => (
                      <div key={u.id} className="fd-user-card">
                        <div className="fd-user-avatar">
                          <span className="fd-avatar-initial">{(u.username || 'U')[0].toUpperCase()}</span>
                          {u.is_online && <span className="avatar-online-dot" />}
                        </div>
                        <div className="fd-user-meta">
                          <strong>{u.username}</strong>
                          <span>
                            {u.grade ? `Class ${u.grade}` : 'Student'} {u.board ? `• ${u.board}` : ''}
                          </span>
                        </div>
                        <div className="fd-user-action">
                          {u.friendship_status === 'friends' ? (
                            <button
                              className="fd-chat-action-btn"
                              onClick={() => handleStartDirectChat(u.id)}
                            >
                              Message
                            </button>
                          ) : u.friendship_status === 'pending_sent' ? (
                            <span className="fd-status-pill">Pending</span>
                          ) : u.friendship_status === 'pending_received' ? (
                            <button
                              className="fd-accept-btn"
                              disabled={!!actionInProgress[u.id]}
                              onClick={() => handleRespondRequest(u.id, true)}
                            >
                              {actionInProgress[u.id] === 'accepting' ? 'Accepting...' : 'Accept'}
                            </button>
                          ) : (
                            <button
                              className="fd-add-btn"
                              disabled={!!actionInProgress[u.id]}
                              onClick={() => handleSendFriendRequest(u.id)}
                            >
                              {actionInProgress[u.id] === 'sending' ? 'Sending...' : '+ Connect'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchError && <div className="fd-search-msg">{searchError}</div>}

              {/* Pending Friend Requests */}
              {pending.incoming.length > 0 && (
                <div className="fd-section">
                  <h5 className="fd-section-title">
                    Connection Requests ({pending.incoming.length})
                  </h5>
                  <div className="fd-cards-list">
                    {pending.incoming.map((req) => (
                      <div key={req.request_id} className="fd-user-card request">
                        <div className="fd-user-avatar">
                          <span className="fd-avatar-initial">{(req.username || 'U')[0].toUpperCase()}</span>
                        </div>
                        <div className="fd-user-meta">
                          <strong>{req.username}</strong>
                          <span>
                            {req.grade ? `Class ${req.grade}` : 'Student'} {req.board ? `• ${req.board}` : ''}
                          </span>
                        </div>
                        <div className="fd-request-actions">
                          <button
                            className="fd-accept-btn"
                            disabled={!!actionInProgress[req.user_id]}
                            onClick={() => handleRespondRequest(req.user_id, true)}
                          >
                            {actionInProgress[req.user_id] === 'accepting' ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            className="fd-decline-btn"
                            disabled={!!actionInProgress[req.user_id]}
                            onClick={() => handleRespondRequest(req.user_id, false)}
                          >
                            {actionInProgress[req.user_id] === 'declining' ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted Classmates List */}
              <div className="fd-section">
                <h5 className="fd-section-title">
                  Connected Classmates ({friends.length})
                </h5>
                {friends.length === 0 ? (
                  <div className="fd-empty-small">
                    No classmates connected yet. Search above by username to connect!
                  </div>
                ) : (
                  <div className="fd-cards-list">
                    {friends.map((f) => (
                      <div key={f.id} className="fd-user-card">
                        <div className="fd-user-avatar">
                          <span className="fd-avatar-initial">{(f.username || 'U')[0].toUpperCase()}</span>
                          {f.is_online && <span className="avatar-online-dot" />}
                        </div>
                        <div className="fd-user-meta">
                          <strong>{f.username}</strong>
                          <span>
                            {f.grade ? `Class ${f.grade}` : 'Student'} {f.board ? `• ${f.board}` : ''}
                          </span>
                        </div>
                        <button
                          className="fd-chat-action-btn"
                          onClick={() => handleStartDirectChat(f.id)}
                        >
                          Message
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            MODAL: CREATE NEW STUDY CIRCLE / GROUP
           =================================================================== */}
        {showCreateGroup && (
          <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
            <div className="fd-create-group-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fd-cgm-header">
                <h4>Create Study Circle</h4>
                <button className="icon-btn" onClick={() => setShowCreateGroup(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateGroup}>
                <div className="fd-cgm-body">
                  {groupError && <div className="share-doubt-error">{groupError}</div>}

                  <label className="tw-label">
                    Circle Name
                    <input
                      type="text"
                      className="tw-input"
                      placeholder="e.g. Physics Class 10 Doubt Circle"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      maxLength={50}
                      required
                    />
                  </label>

                  <label className="tw-label" style={{ marginTop: 12 }}>
                    Select Classmates to Invite:
                  </label>
                  {friends.length === 0 ? (
                    <p className="fd-cgm-empty">
                      You need at least one connected classmate to start a study circle! Connect with classmates first.
                    </p>
                  ) : (
                    <div className="fd-cgm-friends-checklist">
                      {friends.map((f) => {
                        const checked = selectedGroupMembers.includes(f.id)
                        return (
                          <label key={f.id} className="fd-cgm-check-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedGroupMembers((prev) =>
                                  checked ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                                )
                              }}
                            />
                            <span>{f.username}</span>
                            {f.grade && <small>Class {f.grade}</small>}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="fd-cgm-footer">
                  <button
                    type="button"
                    className="tw-btn-ghost"
                    onClick={() => setShowCreateGroup(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tw-btn-primary"
                    disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                  >
                    Create Circle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
