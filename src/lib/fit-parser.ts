import FitParser from 'fit-file-parser'

export interface ParsedFitData {
  date: string
  duration_seconds: number
  distance_meters?: number
  avg_power?: number
  normalized_power?: number
  max_power?: number
  avg_hr?: number
  max_hr?: number
  avg_cadence?: number
  avg_speed?: number
  total_ascent?: number
  records: PowerRecord[]
}

interface PowerRecord {
  timestamp: number
  power?: number
  heart_rate?: number
  cadence?: number
  speed?: number
}

export async function parseFitFile(buffer: ArrayBuffer): Promise<ParsedFitData> {
  return new Promise((resolve, reject) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
      elapsedRecordField: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitParser.parse(Buffer.from(buffer), (error: string | undefined, data: any) => {
      if (error) {
        reject(new Error(error))
        return
      }

      const fitResult = data as FitParseResult

      const session = fitResult.sessions?.[0]
      const records: PowerRecord[] = (fitResult.records || []).map((r: FitRecord) => ({
        timestamp: new Date(r.timestamp).getTime(),
        power: r.power,
        heart_rate: r.heart_rate,
        cadence: r.cadence,
        speed: r.speed,
      }))

      // Calculate normalized power from records
      const normalizedPower = calculateNormalizedPower(records)

      resolve({
        date: session?.start_time
          ? new Date(session.start_time).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        duration_seconds: session?.total_timer_time || 0,
        distance_meters: session?.total_distance,
        avg_power: session?.avg_power,
        normalized_power: normalizedPower,
        max_power: session?.max_power,
        avg_hr: session?.avg_heart_rate,
        max_hr: session?.max_heart_rate,
        avg_cadence: session?.avg_cadence,
        avg_speed: session?.avg_speed,
        total_ascent: session?.total_ascent,
        records,
      })
    })
  })
}

interface FitParseResult {
  sessions?: FitSession[]
  records?: FitRecord[]
}

interface FitSession {
  start_time?: string
  total_timer_time?: number
  total_distance?: number
  avg_power?: number
  max_power?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_cadence?: number
  avg_speed?: number
  total_ascent?: number
}

interface FitRecord {
  timestamp: string
  power?: number
  heart_rate?: number
  cadence?: number
  speed?: number
}

// Calculate Normalized Power using 30-second rolling average
function calculateNormalizedPower(records: PowerRecord[]): number {
  if (records.length < 30) {
    // Not enough data for 30-sec rolling average
    const powers = records.filter(r => r.power).map(r => r.power!)
    if (powers.length === 0) return 0
    return Math.round(Math.pow(powers.reduce((a, b) => a + Math.pow(b, 4), 0) / powers.length, 0.25))
  }

  // Get power values (assume 1 record per second)
  const powers = records.filter(r => r.power !== undefined).map(r => r.power!)
  if (powers.length < 30) return 0

  // Calculate 30-second rolling average
  const rollingAverages: number[] = []
  for (let i = 29; i < powers.length; i++) {
    const window = powers.slice(i - 29, i + 1)
    const avg = window.reduce((a, b) => a + b, 0) / 30
    rollingAverages.push(avg)
  }

  // Fourth power average, then fourth root
  const fourthPowerAvg = rollingAverages.reduce((a, b) => a + Math.pow(b, 4), 0) / rollingAverages.length
  return Math.round(Math.pow(fourthPowerAvg, 0.25))
}

// Calculate TSS (Training Stress Score)
export function calculateTSS(
  normalizedPower: number,
  durationSeconds: number,
  ftp: number
): number {
  if (!normalizedPower || !durationSeconds || !ftp) return 0
  const intensityFactor = normalizedPower / ftp
  const tss = ((durationSeconds * normalizedPower * intensityFactor) / (ftp * 3600)) * 100
  return Math.round(tss)
}

// Calculate Intensity Factor
export function calculateIF(normalizedPower: number, ftp: number): number {
  if (!normalizedPower || !ftp) return 0
  return Math.round((normalizedPower / ftp) * 100) / 100
}
