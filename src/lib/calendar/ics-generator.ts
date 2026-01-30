/**
 * ICS Calendar Generator
 *
 * Generates valid iCalendar (RFC 5545) files for training plan export.
 * Compatible with Apple Calendar, Google Calendar, and Outlook.
 */

export interface CalendarEvent {
  uid: string
  summary: string
  description?: string
  date: string // YYYY-MM-DD
  durationMinutes?: number
  allDay?: boolean
  category?: string
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatDateTimeLocal(dateStr: string, hours: number, minutes: number): string {
  // Format as YYYYMMDDTHHMMSS (local time, no Z suffix)
  const d = dateStr.replace(/-/g, '')
  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  return `${d}T${h}${m}00`
}

function formatDateAllDay(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function formatDtstamp(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const h = String(now.getUTCHours()).padStart(2, '0')
  const min = String(now.getUTCMinutes()).padStart(2, '0')
  const s = String(now.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}

function addMinutes(dateStr: string, startHour: number, startMinute: number, durationMinutes: number): string {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setHours(startHour, startMinute + durationMinutes, 0, 0)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}00`
}

export function generateICS(events: CalendarEvent[], calendarName?: string): string {
  const dtstamp = formatDtstamp()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Training Analyst//Training Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  if (calendarName) {
    lines.push(`X-WR-CALNAME:${escapeICS(calendarName)}`)
  }

  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.uid}`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`SUMMARY:${escapeICS(event.summary)}`)

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateAllDay(event.date)}`)
      // All-day events end on the next day in iCal format
      const nextDay = new Date(`${event.date}T12:00:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      const endStr = nextDay.toISOString().split('T')[0]
      lines.push(`DTEND;VALUE=DATE:${formatDateAllDay(endStr)}`)
    } else {
      // Timed event: default start at 6:00 AM
      const startHour = 6
      const startMin = 0
      const duration = event.durationMinutes || 60
      lines.push(`DTSTART:${formatDateTimeLocal(event.date, startHour, startMin)}`)
      lines.push(`DTEND:${addMinutes(event.date, startHour, startMin, duration)}`)
    }

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
    }

    if (event.category) {
      lines.push(`CATEGORIES:${escapeICS(event.category)}`)
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n') + '\r\n'
}
