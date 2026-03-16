import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ground: '#FAFAF8',
        primary: '#18181B',
        secondary: '#3F3F46',
        tertiary: '#71717A',
        faint: '#A1A1AA',
        lime: '#BFFF00',
        'lime-dark': '#8FB300',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F4F4F5',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}

export default config
