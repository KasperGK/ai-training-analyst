'use client'

interface SessionScoreGaugeProps {
  score: number | null
  size?: 'sm' | 'md'
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'hsl(142, 71%, 45%)' // green
  if (score >= 60) return 'hsl(38, 92%, 50%)' // amber
  return 'hsl(0, 84%, 60%)' // red
}

export function SessionScoreGauge({ score, size = 'sm' }: SessionScoreGaugeProps) {
  if (score === null) {
    return (
      <span className="text-xs text-muted-foreground">···</span>
    )
  }

  const color = getScoreColor(score)

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold tabular-nums text-xs">{score}</span>
      </span>
    )
  }

  // SVG arc gauge — score determines how much of the circle is filled
  const svgSize = 40
  const strokeWidth = 2.5
  const radius = (svgSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const gap = circumference - filled

  return (
    <div className="relative flex-shrink-0" style={{ width: svgSize, height: svgSize }}>
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="hsl(0 0% 20%)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-sm">
        {score}
      </span>
    </div>
  )
}
