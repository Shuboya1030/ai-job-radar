'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface BarChartProps {
  data: { name: string; value: number; pct?: number }[]
  color?: string
  height?: number
  showPercentage?: boolean
}

export default function HorizontalBarChart({
  data,
  color = '#3b82f6',
  height = 400,
  showPercentage = true,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-ink-muted text-sm py-8 text-center">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 13, fill: '#475569' }}
        />
        <Tooltip
          formatter={(value: number, _name: string, props: any) => {
            const pct = props.payload.pct
            return pct ? [`${value} (${pct}%)`, 'Mentions'] : [value, 'Mentions']
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={1 - i * 0.02} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
