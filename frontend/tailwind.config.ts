import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A3E6B',      // Dark Navy
        secondary: '#00B8D9',    // Cyan-Teal
        background: '#F5F7FA',   // Light Gray
        surface: '#FFFFFF',      // White
        'text-primary': '#212529',
        'text-secondary': '#495057',
        'neutral-gray': '#6C757D',
        'neutral-light': '#DEE2E6',
        error: '#E63946',        // Crimson
        warning: '#FFC107',      // Amber
        success: '#28A745',      // Green
      },
      fontFamily: {
        sans: ['Source Sans Pro', 'sans-serif'],
        mono: ['Fira Mono', 'monospace'],
      },
      fontSize: {
        'h1': '32px',
        'h2': '24px',
        'h3': '20px',
        'body': '16px',
        'small': '14px',
      },
      lineHeight: {
        'heading': '1.3',
        'body': '1.5',
      },
      borderRadius: {
        'btn': '4px',
        'card': '6px',
        'input': '4px',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0,0,0,0.05)',
        'hover': '0 4px 6px rgba(0,0,0,0.1)',
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
        '48': '48px',
        '64': '64px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config
