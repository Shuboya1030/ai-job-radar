'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface BarChartProps {
  data: { name: string; value: number; pct?: number }[]
  color?: string
  height?: number
}

export default function HorizontalBarChart({
  data,
  color = '#18181B',
  height = 400,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-faint text-xs font-mono py-8 text-center">NO DATA</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fontSize: 12, fill: '#3F3F46', fontFamily: 'DM Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number, _name: string, props: any) => {
            const pct = props.payload.pct
            return pct ? [`${value} (${pct}%)`, ''] : [value, '']
          }}
          contentStyle={{
            borderRadius: 4,
            border: '1px solid #E4E4E7',
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
            padding: '6px 10px',
          }}
          labelStyle={{ fontFamily: 'DM Sans', fontWeight: 600, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
          {data.map((entry, i) => (
            <Cell key={i} fill={color} fillOpacity={1 - i * 0.03} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
