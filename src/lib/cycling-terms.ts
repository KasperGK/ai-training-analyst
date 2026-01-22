/**
 * Cycling Terms Dictionary
 *
 * Definitions for common cycling/training metrics used in tooltips.
 * These terms are detected in AI messages and displayed with hover definitions.
 */

export interface CyclingTerm {
  term: string
  definition: string
  unit?: string
}

export const CYCLING_TERMS: Record<string, CyclingTerm> = {
  FTP: {
    term: 'FTP',
    definition: 'Functional Threshold Power - the maximum power you can sustain for approximately one hour. Used as the basis for training zones.',
    unit: 'W',
  },
  TSS: {
    term: 'TSS',
    definition: 'Training Stress Score - a measure of training load that accounts for both intensity and duration. 100 TSS is roughly equivalent to an hour at FTP.',
  },
  CTL: {
    term: 'CTL',
    definition: 'Chronic Training Load (Fitness) - a rolling average of your TSS over ~42 days. Higher CTL means better fitness.',
  },
  ATL: {
    term: 'ATL',
    definition: 'Acute Training Load (Fatigue) - a rolling average of your TSS over ~7 days. Represents recent training stress.',
  },
  TSB: {
    term: 'TSB',
    definition: 'Training Stress Balance (Form) - CTL minus ATL. Positive values indicate freshness, negative values indicate fatigue.',
  },
  IF: {
    term: 'IF',
    definition: 'Intensity Factor - the ratio of your Normalized Power to your FTP. An IF of 1.0 means you averaged your FTP.',
  },
  NP: {
    term: 'NP',
    definition: 'Normalized Power - a weighted average that better represents the physiological cost of variable-intensity riding.',
    unit: 'W',
  },
  LTHR: {
    term: 'LTHR',
    definition: 'Lactate Threshold Heart Rate - the heart rate at which lactate begins to accumulate rapidly. Used for HR-based training zones.',
    unit: 'bpm',
  },
  VO2max: {
    term: 'VO2max',
    definition: 'Maximum oxygen uptake - the maximum rate at which your body can use oxygen during intense exercise. A key indicator of aerobic fitness.',
    unit: 'ml/kg/min',
  },
  'W/kg': {
    term: 'W/kg',
    definition: 'Watts per kilogram - power relative to body weight. Critical for climbing and a key fitness benchmark.',
    unit: 'W/kg',
  },
  PMC: {
    term: 'PMC',
    definition: 'Performance Management Chart - a graph showing CTL, ATL, and TSB over time to visualize fitness, fatigue, and form.',
  },
  ACWR: {
    term: 'ACWR',
    definition: 'Acute:Chronic Workload Ratio - ATL divided by CTL. Values between 0.8-1.3 are considered optimal for adaptation.',
  },
  EF: {
    term: 'EF',
    definition: 'Efficiency Factor - Normalized Power divided by average heart rate. Higher values indicate better aerobic efficiency.',
  },
  VI: {
    term: 'VI',
    definition: 'Variability Index - Normalized Power divided by Average Power. Values close to 1.0 indicate steady-state riding.',
  },
  Z1: {
    term: 'Z1',
    definition: 'Zone 1 - Active Recovery. Very easy effort at <55% of FTP.',
  },
  Z2: {
    term: 'Z2',
    definition: 'Zone 2 - Endurance. Aerobic base building at 56-75% of FTP.',
  },
  Z3: {
    term: 'Z3',
    definition: 'Zone 3 - Tempo. Moderate intensity at 76-90% of FTP.',
  },
  Z4: {
    term: 'Z4',
    definition: 'Zone 4 - Threshold. Hard effort at 91-105% of FTP.',
  },
  Z5: {
    term: 'Z5',
    definition: 'Zone 5 - VO2max. Very hard intervals at 106-120% of FTP.',
  },
  Z6: {
    term: 'Z6',
    definition: 'Zone 6 - Anaerobic Capacity. Maximum effort intervals at >120% of FTP.',
  },
}

/**
 * Pattern to detect standalone cycling terms in text.
 * Matches terms when they appear as whole words (not part of a number like "285 TSS").
 * The metric pattern in formatted-message.tsx handles "285 TSS" - this catches standalone "TSS".
 */
export const TERM_PATTERN = new RegExp(
  `\\b(${Object.keys(CYCLING_TERMS).join('|')})\\b`,
  'g'
)

/**
 * Get the definition for a cycling term
 */
export function getTermDefinition(term: string): CyclingTerm | undefined {
  return CYCLING_TERMS[term.toUpperCase()] || CYCLING_TERMS[term]
}
