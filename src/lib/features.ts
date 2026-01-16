/**
 * Centralized feature flags
 *
 * All features are ENABLED by default.
 * Set FEATURE_X=false in environment to disable.
 *
 * Usage:
 *   import { features } from '@/lib/features'
 *   if (features.localData) { ... }
 */

export const features = {
  /** Use local Supabase data instead of live intervals.icu calls */
  localData: process.env.FEATURE_LOCAL_DATA !== 'false',

  /** Enable RAG (Retrieval Augmented Generation) for knowledge search */
  rag: process.env.FEATURE_RAG !== 'false',

  /** Enable athlete memory/personalization */
  memory: process.env.FEATURE_MEMORY !== 'false',

  /** Enable proactive insights generation */
  insights: process.env.FEATURE_INSIGHTS !== 'false',
} as const

export type FeatureFlags = typeof features
