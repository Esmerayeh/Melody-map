export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface, #0B0B12)',
          1: 'var(--color-surface-1, #0F0F1A)',
          2: 'var(--color-surface-2, #151528)',
          3: 'var(--color-surface-3, #1A1A32)',
          4: '#1F1F3A',
        },
        brand: {
          purple:  'var(--color-brand-purple,  #7c6fff)',
          pink:    'var(--color-brand-pink,    #f28ddf)',
          blue:    'var(--color-brand-blue,    #8fa8ff)',
          teal:    'var(--color-brand-teal,    #88b8d8)',
          amber:   'var(--color-brand-amber,   #d7a56f)',
          magenta: 'var(--color-brand-magenta, #b77dff)',
          cyan:    'var(--color-brand-cyan,    #9fd0ff)',
          rose:    'var(--color-brand-rose,    #f472b6)',
          indigo:  'var(--color-brand-indigo,  #818cf8)',
          silver:  'var(--color-brand-silver,  #bba4ff)',
        },
      },
      fontFamily: {
        sans:    ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Cinzel', 'serif'],
        cinzel:  ['Cinzel', 'serif'],
        manrope: ['Manrope', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'cosmic': 'linear-gradient(135deg, #0B0B12 0%, #151528 100%)',
        'glow-purple': 'radial-gradient(ellipse at center, rgba(108,92,231,0.15) 0%, transparent 70%)',
        'glow-pink':   'radial-gradient(ellipse at center, rgba(255,93,162,0.12) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgba(108,92,231,0.25)',
        'glow-md':  '0 0 24px rgba(108,92,231,0.3)',
        'glow-lg':  '0 0 48px rgba(108,92,231,0.2)',
        'glow-pink':'0 0 24px rgba(255,93,162,0.3)',
      },
      animation: {
        'float':      'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'fade-up':    'fadeUp 0.4s ease forwards',
      },
      keyframes: {
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeUp:  { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
