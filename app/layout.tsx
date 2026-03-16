import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/nav'
import Footer from '@/components/footer'
import Analytics from '@/components/analytics'

export const metadata: Metadata = {
  title: 'AIJobRadar — AI Career Intelligence',
  description: 'Data-driven job market insights for AI professionals. Skills analysis, salary benchmarks, and unified job board.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <Analytics />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
