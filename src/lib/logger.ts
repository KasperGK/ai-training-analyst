/**
 * Lightweight logger that suppresses output in production.
 *
 * In development (NODE_ENV !== 'production'), all levels are active.
 * In production, only warn and error are active by default.
 * Set LOG_LEVEL=debug to enable all levels in production.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('[sync]', 'Started sync for athlete:', athleteId)
 *   logger.warn('[sync]', 'Slow query detected')
 *   logger.error('[sync]', 'Sync failed:', error)
 */

const isDev = process.env.NODE_ENV !== 'production'
const debugEnabled = process.env.LOG_LEVEL === 'debug'

export const logger = {
  /** Debug-level logging, only in development or when LOG_LEVEL=debug */
  debug: (...args: unknown[]) => {
    if (isDev || debugEnabled) {
      console.log(...args)
    }
  },

  /** Info-level logging, only in development or when LOG_LEVEL=debug */
  info: (...args: unknown[]) => {
    if (isDev || debugEnabled) {
      console.log(...args)
    }
  },

  /** Warnings, always active */
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },

  /** Errors, always active */
  error: (...args: unknown[]) => {
    console.error(...args)
  },
}
