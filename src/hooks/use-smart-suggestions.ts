'use client'

import { useMemo } from 'react'
import type { CurrentFitness, Session } from '@/types'

interface SmartSuggestion {
  label: string
  prompt: string
  priority: number // Higher = more important
}

interface UseSmartSuggestionsParams {
  currentFitness: CurrentFitness | null
  sessions: Session[]
}

/**
 * Generate context-aware quick action suggestions based on:
 * - Time of day
 * - Recent sessions
 * - Current fitness state (TSB/CTL/ATL)
 * - Day of week
 */
export function useSmartSuggestions({ currentFitness, sessions }: UseSmartSuggestionsParams) {
  return useMemo(() => {
    const suggestions: SmartSuggestion[] = []
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Time-based suggestions
    if (hour >= 5 && hour < 12) {
      suggestions.push({
        label: 'Morning check-in',
        prompt: "Good morning! Give me a quick summary of my current form and what I should focus on today.",
        priority: 80,
      })
    }

    // Yesterday's session analysis
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const yesterdaySession = sessions.find(s => s.date === yesterdayStr)
    if (yesterdaySession) {
      const sessionType = yesterdaySession.workout_type || yesterdaySession.sport || 'ride'
      // Truncate for display label but use full type in prompt
      const shortType = sessionType.length > 15
        ? sessionType.slice(0, 15) + '...'
        : sessionType
      suggestions.push({
        label: `Analyze yesterday's ${shortType.toLowerCase()}`,
        prompt: `Analyze my ${sessionType.toLowerCase()} from yesterday (${yesterdayStr}). How did it go? What insights can you share?`,
        priority: 90,
      })
    }

    // TSB-based suggestions (fitness state)
    if (currentFitness) {
      const tsb = currentFitness.tsb ?? 0
      const ctl = currentFitness.ctl ?? 0

      if (tsb > 10) {
        // Fresh - ready for intensity
        suggestions.push({
          label: "I'm fresh - suggest intensity",
          prompt: `My TSB is ${Math.round(tsb)} so I'm well rested. What kind of quality session should I do today?`,
          priority: 85,
        })
      } else if (tsb < -20) {
        // Very fatigued
        suggestions.push({
          label: 'Feeling fatigued',
          prompt: `My TSB is ${Math.round(tsb)} which shows significant fatigue. Should I take a rest day or do recovery? What's the best approach?`,
          priority: 95,
        })
      } else if (tsb < -10) {
        // Moderate fatigue
        suggestions.push({
          label: 'Check recovery status',
          prompt: `My TSB is ${Math.round(tsb)}. Am I building fitness well or do I need to back off?`,
          priority: 70,
        })
      }

      // CTL milestone suggestions
      if (ctl > 80) {
        suggestions.push({
          label: 'Show fitness trends',
          prompt: `My CTL is at ${Math.round(ctl)}. Show me my fitness trends and how I got here.`,
          priority: 60,
        })
      }
    }

    // Weekend planning
    if (isWeekend) {
      suggestions.push({
        label: 'Plan weekend ride',
        prompt: "What should I do for my weekend ride? Suggest a workout based on my current fitness and recent training.",
        priority: 75,
      })
    }

    // Default/fallback suggestions (lower priority)
    suggestions.push(
      {
        label: 'Show fitness',
        prompt: 'Show my current fitness',
        priority: 40,
      },
      {
        label: 'Show PMC',
        prompt: 'Show my PMC chart',
        priority: 35,
      },
      {
        label: 'Show power curve',
        prompt: 'Show my power curve',
        priority: 30,
      },
      {
        label: 'Suggest workout',
        prompt: 'Suggest a workout for today based on my current fitness and recent training.',
        priority: 50,
      }
    )

    // Sort by priority (highest first) and return top 4
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 4)
  }, [currentFitness, sessions])
}
