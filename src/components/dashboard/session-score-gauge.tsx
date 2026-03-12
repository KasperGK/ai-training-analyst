'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

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
  const dims = size === 'sm' ? 32 : 48
  const outerRadius = size === 'sm' ? 14 : 21
  const innerRadius = size === 'sm' ? 10 : 16
  const barSize = size === 'sm' ? 4 : 5
  const fontSize = size === 'sm' ? '9px' : '12px'

  if (score === null) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ width: dims, height: dims }}
      >
        <span className="text-xs">···</span>
      </div>
    )
  }

  const color = getScoreColor(score)
  const chartData = [{ name: 'score', value: score, fill: color }]

  return (
    <div className="relative" style={{ width: dims, height: dims }}>
      <RadialBarChart
        width={dims}
        height={dims}
        cx={dims / 2}
        cy={dims / 2}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        barSize={barSize}
        data={chartData}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, 100]}
          angleAxisId={0}
          tick={false}
        />
        <RadialBar
          background={{ fill: 'hsl(0 0% 20%)' }}
          dataKey="value"
          cornerRadius={10}
          angleAxisId={0}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize }}>
          {score}
        </span>
      </div>
    </div>
  )
}
