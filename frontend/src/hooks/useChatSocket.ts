import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentName, AgentState, Chat, ChatMessage, Report, ServerEvent } from '../types'

const AGENT_ORDER: AgentName[] = ['Orchestrator', 'Literature', 'ClinicalTrial', 'Guideline', 'Biomarker', 'Web Sources', 'Synthesizer']
const STORAGE_KEY = 'tumorboard.chats.v1'

function initialAgents(): Record<AgentName, AgentState> {
  return AGENT_ORDER.reduce((acc, name) => {
    acc[name] = { status: 'idle', message: '', history: [] }
    return acc
  }, {} as Record<AgentName, AgentState>)
}

function newChat(): Chat {
  return { id: crypto.randomUUID(), title: 'New chat', messages: [] }
}

function loadChats(): { chats: Chat[]; activeChatId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.chats) && parsed.chats.length > 0) {
        // never resurrect a mid-stream state from a previous session
        const chats = parsed.chats.map((c: Chat) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, streaming: false })),
        }))
        return { chats, activeChatId: parsed.activeChatId ?? chats[0].id }
      }
    }
  } catch {
    // fall through to a fresh chat
  }
  const chat = newChat()
  return { chats: [chat], activeChatId: chat.id }
}

function titleFromQuestion(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed
}

export function useChatSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingReportRef = useRef<Report | null>(null)
  const pendingChatIdRef = useRef<string | null>(null)

  const [{ chats, activeChatId }, setState] = useState(loadChats)
  const [connected, setConnected] = useState(false)
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(initialAgents)
  const [thinkingChatId, setThinkingChatId] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, activeChatId }))
  }, [chats, activeChatId])

  const updateChatMessages = useCallback((chatId: string, updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    setState((prev) => ({
      ...prev,
      chats: prev.chats.map((c) => (c.id === chatId ? { ...c, messages: updater(c.messages) } : c)),
    }))
  }, [])

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws/chat`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (event) => {
      const data: ServerEvent = JSON.parse(event.data)
      const chatId = pendingChatIdRef.current
      if (!chatId && data.type !== 'agent_status') return

      switch (data.type) {
        case 'agent_status': {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setAgents((prev) => {
            const name = data.agent as AgentName
            const prevState = prev[name]
            return {
              ...prev,
              [name]: {
                status: data.status,
                message: data.message,
                history: [...prevState.history, { status: data.status, message: data.message, time }],
              },
            }
          })
          break
        }
        case 'token': {
          updateChatMessages(chatId!, (msgs) => {
            const next = [...msgs]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant' && last.streaming) {
              next[next.length - 1] = { ...last, content: last.content + data.content }
            } else {
              next.push({ role: 'assistant', content: data.content, streaming: true })
            }
            return next
          })
          break
        }
        case 'report': {
          pendingReportRef.current = data.report
          break
        }
        case 'done': {
          // Capture now -- setState's updater runs on React's schedule, not
          // synchronously here, so reading the ref lazily inside the updater
          // would see it already cleared by the lines below.
          const finalReport = pendingReportRef.current
          updateChatMessages(chatId!, (msgs) => {
            const next = [...msgs]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, streaming: false, report: finalReport ?? undefined }
            }
            return next
          })
          pendingReportRef.current = null
          pendingChatIdRef.current = null
          setThinkingChatId(null)
          break
        }
      }
    }

    return () => ws.close()
  }, [updateChatMessages])

  const sendMessage = useCallback(
    (text: string, uploadId?: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return

      pendingChatIdRef.current = activeChatId
      setState((prev) => ({
        ...prev,
        chats: prev.chats.map((c) =>
          c.id === activeChatId
            ? { ...c, title: c.messages.length === 0 ? titleFromQuestion(text) : c.title, messages: [...c.messages, { role: 'user', content: text }] }
            : c,
        ),
      }))
      setThinkingChatId(activeChatId)
      ws.send(JSON.stringify({ message: text, chat_id: activeChatId, upload_id: uploadId ?? undefined }))
    },
    [activeChatId],
  )

  const startNewChat = useCallback(() => {
    const chat = newChat()
    setState((prev) => ({ chats: [chat, ...prev.chats], activeChatId: chat.id }))
    setAgents(initialAgents())
  }, [])

  const selectChat = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeChatId: id }))
    // only reset agents if no response is currently in flight
    if (!pendingChatIdRef.current) setAgents(initialAgents())
  }, [])

  const deleteChat = useCallback((id: string) => {
    setState((prev) => {
      const remaining = prev.chats.filter((c) => c.id !== id)
      if (remaining.length === 0) {
        const fresh = newChat()
        return { chats: [fresh], activeChatId: fresh.id }
      }
      const newActive = prev.activeChatId === id ? remaining[0].id : prev.activeChatId
      return { chats: remaining, activeChatId: newActive }
    })
  }, [])

  const deleteAllChats = useCallback(() => {
    const fresh = newChat()
    setState({ chats: [fresh], activeChatId: fresh.id })
    setAgents(initialAgents())
  }, [])

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0]
  const thinking = thinkingChatId === activeChatId

  return {
    connected,
    messages: activeChat?.messages ?? [],
    chats,
    activeChatId,
    agents,
    thinking,
    sendMessage: sendMessage as (text: string, uploadId?: string) => void,
    startNewChat,
    selectChat,
    deleteChat,
    deleteAllChats,
  }
}
