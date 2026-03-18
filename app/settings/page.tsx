'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Bell, Plus, Trash2, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const ROLE_OPTIONS = ['AI PM', 'AI Engineer', 'Software Engineer']
const INDUSTRY_OPTIONS = ['AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS', 'Cybersecurity', 'Robotics', 'EdTech', 'Adtech', 'Cloud/Infra', 'Gaming', 'Automotive', 'Biotech', 'Enterprise Software', 'Social/Media']
const FUNDING_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public']
const WORK_TYPE_OPTIONS = ['Remote', 'Hybrid', 'On-site']

interface Subscription {
  id: string
  name: string
  roles: string[]
  industries: string[]
  funding_stages: string[]
  work_types: string[]
  frequency: string
  is_active: boolean
}

export default function SettingsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [name, setName] = useState('My Alert')
  const [roles, setRoles] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [fundingStages, setFundingStages] = useState<string[]>([])
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [frequency, setFrequency] = useState('weekly')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => { setSubs(d.subscriptions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  if (authLoading) return <div className="max-w-3xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Loading...</div>

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <Bell className="w-10 h-10 text-faint mx-auto mb-4" />
        <h1 className="text-xl font-bold text-primary mb-2">Job Alerts</h1>
        <p className="text-sm text-secondary mb-6">Sign in to set up personalized job alerts and never miss a matching opportunity.</p>
        <button onClick={signInWithGoogle} className="px-5 py-2.5 bg-lime text-black font-bold text-sm rounded hover:bg-lime-dark transition-colors">
          Sign in with Google
        </button>
      </div>
    )
  }

  async function createSubscription() {
    setSaving(true)
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, roles, industries, funding_stages: fundingStages, work_types: workTypes, frequency }),
    })
    if (res.ok) {
      const sub = await res.json()
      setSubs(prev => [sub, ...prev])
      setShowForm(false)
      resetForm()
    }
    setSaving(false)
  }

  async function deleteSub(id: string) {
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
    setSubs(prev => prev.filter(s => s.id !== id))
  }

  function resetForm() {
    setName('My Alert')
    setRoles([])
    setIndustries([])
    setFundingStages([])
    setWorkTypes([])
    setFrequency('weekly')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-primary">Job Alerts</h1>
          <p className="text-xs font-mono text-tertiary mt-1">Get notified when new matching jobs appear</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-lime text-black text-xs font-bold rounded hover:bg-lime-dark transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Alert
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-bold text-primary mb-4">Create Job Alert</h2>

          <div className="space-y-4">
            <div>
              <label className="section-label mb-1.5 block">Alert Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-zinc-200 text-sm focus:outline-none focus:border-zinc-400" />
            </div>

            <MultiSelect label="Roles" options={ROLE_OPTIONS} selected={roles} onChange={setRoles} />
            <MultiSelect label="Industries" options={INDUSTRY_OPTIONS} selected={industries} onChange={setIndustries} />
            <MultiSelect label="Funding Stages" options={FUNDING_OPTIONS} selected={fundingStages} onChange={setFundingStages} />
            <MultiSelect label="Work Type" options={WORK_TYPE_OPTIONS} selected={workTypes} onChange={setWorkTypes} />

            <div>
              <label className="section-label mb-1.5 block">Frequency</label>
              <div className="flex gap-2">
                {['daily', 'weekly'].map(f => (
                  <button key={f} onClick={() => setFrequency(f)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      frequency === f ? 'bg-primary text-white' : 'bg-surface-raised text-secondary hover:text-primary'
                    }`}>
                    {f === 'daily' ? 'Daily' : 'Weekly (Mon)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={createSubscription} disabled={saving}
                className="px-4 py-2 bg-lime text-black text-xs font-bold rounded hover:bg-lime-dark transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Alert'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 text-xs text-secondary hover:text-primary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Subscriptions */}
      {loading ? (
        <p className="text-tertiary text-sm text-center py-8">Loading...</p>
      ) : subs.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <Bell className="w-8 h-8 text-faint mx-auto mb-3" />
          <p className="text-sm text-tertiary">No alerts yet. Create one to get notified about matching jobs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <div key={sub.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">{sub.name}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {sub.roles?.map((r: string) => <span key={r} className="badge bg-surface-raised text-secondary">{r}</span>)}
                  {sub.industries?.map((i: string) => <span key={i} className="badge bg-primary/5 text-primary">{i}</span>)}
                  {sub.funding_stages?.map((f: string) => <span key={f} className="badge bg-lime/20 text-lime-dark">{f}</span>)}
                  {sub.work_types?.map((w: string) => <span key={w} className="badge bg-surface-raised text-tertiary">{w}</span>)}
                </div>
                <p className="text-2xs font-mono text-faint mt-1.5">{sub.frequency}</p>
              </div>
              <button onClick={() => deleteSub(sub.id)} className="p-2 text-faint hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <div>
      <label className="section-label mb-1.5 block">{label} <span className="text-faint">(leave empty = all)</span></label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selected.includes(opt) ? 'bg-primary text-white' : 'bg-surface-raised text-secondary hover:text-primary'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
