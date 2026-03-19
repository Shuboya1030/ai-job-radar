'use client'

import { useState, useCallback } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { useAuth } from './auth-provider'

interface ResumeUploadProps {
  onUploadComplete?: () => void
}

export default function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const { user, signInWithGoogle } = useAuth()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!user) {
      signInWithGoogle()
      return
    }

    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }

      onUploadComplete?.()
    } catch (err) {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [user, signInWithGoogle, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
        ${dragging ? 'border-lime bg-lime/5' : 'border-faint hover:border-lime/50'}
        ${uploading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="file"
        accept=".pdf,.docx,.md,.markdown"
        onChange={handleChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-lime animate-spin" />
          <p className="text-secondary">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-tertiary" />
          <p className="text-primary font-medium">Drop your resume here or click to browse</p>
          <p className="text-tertiary text-sm">PDF, DOCX, or Markdown (max 5MB)</p>
        </div>
      )}
      {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
    </div>
  )
}
