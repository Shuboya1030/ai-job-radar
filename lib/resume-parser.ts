const MAX_TEXT_LENGTH = 50_000 // Truncate to prevent runaway API costs

export type FileType = 'pdf' | 'docx' | 'md'

export function detectFileType(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return null
}

export async function extractText(buffer: Buffer, fileType: FileType): Promise<string> {
  let text: string

  switch (fileType) {
    case 'pdf': {
      // Import lib/pdf-parse directly to skip index.js debug mode test file loading
      const pdfParse = require('pdf-parse/lib/pdf-parse.js')
      const result = await pdfParse(buffer)
      text = result.text
      break
    }
    case 'docx': {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
      break
    }
    case 'md': {
      text = buffer.toString('utf-8')
      break
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Could not extract any text from the file')
  }

  // Truncate to prevent excessive API costs
  return text.slice(0, MAX_TEXT_LENGTH)
}
