'use client'

/**
 * Custom Suggestions Hook
 *
 * Persists user-defined quick action suggestions to localStorage.
 * Features:
 * - Add/remove custom suggestions
 * - Max 10 suggestions
 * - Handles SSR safely
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'custom-suggestions-v1'
const MAX_SUGGESTIONS = 10

export interface CustomSuggestion {
  id: string
  label: string
  prompt: string
}

export function useCustomSuggestions() {
  const [suggestions, setSuggestions] = useState<CustomSuggestion[]>([])
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as CustomSuggestion[]
        if (Array.isArray(parsed)) {
          setSuggestions(parsed.slice(0, MAX_SUGGESTIONS))
        }
      }
    } catch (e) {
      console.warn('Failed to load custom suggestions:', e)
    }
  }, [])

  // Save to localStorage
  const saveSuggestions = useCallback((newSuggestions: CustomSuggestion[]) => {
    const trimmed = newSuggestions.slice(0, MAX_SUGGESTIONS)
    setSuggestions(trimmed)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch (e) {
      console.warn('Failed to save custom suggestions:', e)
    }
  }, [])

  // Add a new suggestion
  const addSuggestion = useCallback(
    (label: string, prompt: string) => {
      const newSuggestion: CustomSuggestion = {
        id: `custom-${Date.now()}`,
        label: label.trim(),
        prompt: prompt.trim(),
      }
      saveSuggestions([...suggestions, newSuggestion])
    },
    [suggestions, saveSuggestions]
  )

  // Remove a suggestion by ID
  const removeSuggestion = useCallback(
    (id: string) => {
      saveSuggestions(suggestions.filter((s) => s.id !== id))
    },
    [suggestions, saveSuggestions]
  )

  // Check if at max capacity
  const canAddMore = suggestions.length < MAX_SUGGESTIONS

  return {
    suggestions,
    mounted,
    addSuggestion,
    removeSuggestion,
    canAddMore,
    maxSuggestions: MAX_SUGGESTIONS,
  }
}
