'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#18181B', '#BFFF00', '#71717A', '#A1A1AA', '#D4D4D8', '#E4E4E7', '#F4F4F5']

interface PieChartProps {
  data: { name: string; value: number }[]
  height?: number
}

export default function DonutChart({ data, height = 260 }: PieChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-faint text-xs font-mono py-8 text-center">NO DATA</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 4,
            border: '1px solid #E4E4E7',
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
            padding: '6px 10px',
          }}
        />
        <Legend
          verticalAlign="middle"
          align="right"
          layout="vertical"
          iconType="square"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
