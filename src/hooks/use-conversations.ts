'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Conversation {
  id: string
  title: string
  last_message_at: string
  message_count: number
  preview?: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: unknown
  created_at: string
}

interface UseConversationsReturn {
  conversations: Conversation[]
  loading: boolean
  currentConversationId: string | null
  currentMessages: ChatMessage[]
  loadingMessages: boolean

  // Actions
  loadConversations: () => Promise<void>
  loadConversation: (id: string) => Promise<void>
  startNewConversation: () => void
  deleteConversation: (id: string) => Promise<boolean>
  saveMessage: (role: 'user' | 'assistant', content: string, toolCalls?: unknown) => Promise<void>
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Load all conversations
  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load a specific conversation's messages
  const loadConversation = useCallback(async (id: string) => {
    setLoadingMessages(true)
    setCurrentConversationId(id)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setCurrentMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      setCurrentMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // Start a new conversation
  const startNewConversation = useCallback(() => {
    const newId = crypto.randomUUID()
    setCurrentConversationId(newId)
    setCurrentMessages([])
  }, [])

  // Delete a conversation
  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        // Remove from local state
        setConversations((prev) => prev.filter((c) => c.id !== id))

        // If we deleted the current conversation, start fresh
        if (currentConversationId === id) {
          startNewConversation()
        }
        return true
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
    return false
  }, [currentConversationId, startNewConversation])

  // Save a message to current conversation
  const saveMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: unknown
  ) => {
    if (!currentConversationId) {
      console.warn('No conversation ID set')
      return
    }

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
          role,
          content,
          toolCalls,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // Add to local messages
        setCurrentMessages((prev) => [...prev, data.message])

        // Refresh conversations list to update preview/timestamp
        loadConversations()
      }
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }, [currentConversationId, loadConversations])

  // Initial load
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Start with a new conversation if none selected
  useEffect(() => {
    if (!loading && !currentConversationId) {
      // Check if we have conversations - load the most recent one
      if (conversations.length > 0) {
        loadConversation(conversations[0].id)
      } else {
        startNewConversation()
      }
    }
  }, [loading, currentConversationId, conversations, loadConversation, startNewConversation])

  return {
    conversations,
    loading,
    currentConversationId,
    currentMessages,
    loadingMessages,
    loadConversations,
    loadConversation,
    startNewConversation,
    deleteConversation,
    saveMessage,
  }
}
