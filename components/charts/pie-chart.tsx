'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#8b5cf6', '#eab308', '#ec4899', '#06b6d4', '#6366f1', '#78716c']

interface PieChartProps {
  data: { name: string; value: number }[]
  height?: number
}

export default function DonutChart({ data, height = 300 }: PieChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-ink-muted text-sm py-8 text-center">No data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
