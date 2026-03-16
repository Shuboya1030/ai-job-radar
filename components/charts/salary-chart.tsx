'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface SalaryData {
  name: string
  avg_min: number
  avg_max: number
  count: number
}

function formatSalary(val: number) {
  if (val >= 1000) return `$${Math.round(val / 1000)}K`
  return `$${val}`
}

export default function SalaryRangeChart({ data, height = 300 }: { data: SalaryData[]; height?: number }) {
  if (!data || data.length === 0) {
    return <div className="text-faint text-xs font-mono py-8 text-center">NO SALARY DATA</div>
  }

  const chartData = data.map(d => ({
    name: d.name,
    base: d.avg_min,
    range: d.avg_max - d.avg_min,
    avg_min: d.avg_min,
    avg_max: d.avg_max,
    count: d.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#71717A', fontFamily: 'DM Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatSalary}
          tick={{ fontSize: 10, fill: '#A1A1AA', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(_val: number, name: string, props: any) => {
            if (name === 'base') return null
            const { avg_min, avg_max, count } = props.payload
            return [`${formatSalary(avg_min)} – ${formatSalary(avg_max)} (${count} jobs)`, '']
          }}
          contentStyle={{
            borderRadius: 4,
            border: '1px solid #E4E4E7',
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
            padding: '6px 10px',
          }}
        />
        <Bar dataKey="base" stackId="salary" fill="transparent" />
        <Bar dataKey="range" stackId="salary" radius={[3, 3, 0, 0]} barSize={32}>
          {chartData.map((_, i) => (
            <Cell key={i} fill="#BFFF00" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
