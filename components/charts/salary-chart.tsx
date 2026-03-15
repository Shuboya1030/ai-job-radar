'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface SalaryData {
  name: string
  avg_min: number
  avg_max: number
  count: number
}

interface SalaryChartProps {
  data: SalaryData[]
  height?: number
}

function formatSalary(val: number) {
  if (val >= 1000) return `$${Math.round(val / 1000)}K`
  return `$${val}`
}

export default function SalaryRangeChart({ data, height = 350 }: SalaryChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-ink-muted text-sm py-8 text-center">No salary data available</div>
  }

  // Transform for stacked bar: base + range
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
      <BarChart data={chartData} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
        <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#475569' }} />
        <YAxis tickFormatter={formatSalary} tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <Tooltip
          formatter={(_val: number, name: string, props: any) => {
            if (name === 'base') return null
            const { avg_min, avg_max, count } = props.payload
            return [`${formatSalary(avg_min)} — ${formatSalary(avg_max)} (${count} jobs)`, 'Salary Range']
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
        <Bar dataKey="base" stackId="salary" fill="transparent" />
        <Bar dataKey="range" stackId="salary" radius={[4, 4, 0, 0]} barSize={40}>
          {chartData.map((_, i) => (
            <Cell key={i} fill="#3b82f6" fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
