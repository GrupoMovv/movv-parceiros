/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade oficial IUB MAIS+ (mascote 3D + slides promocionais) —
        // convive com o namespace `movv` (Portal Movv, área interna) e
        // `gold`; `iub` é usado nas telas públicas do marketplace/associado.
        iub: {
          roxo: '#7C3AED',
          'roxo-escuro': '#4C1D95',
          'roxo-neon': '#A855F7',
          'roxo-medio': '#9333EA',
          dourado: '#FFB800',
          'dourado-claro': '#FBBF24',
          'dourado-escuro': '#D97706',
          preto: '#1F2937',
          cinza: '#6B7280',
        },
        movv: {
          950:  '#061C2E',   // azul escuro profundo
          900:  '#0C2D48',   // brand primary — sidebar, header, buttons
          850:  '#0E3357',
          800:  '#1A4D7A',   // lighter blue — hover states
          750:  '#1557A0',
          700:  '#1A5E8A',   // borders on dark bg
          600:  '#2196C4',
          500:  '#2EAAD8',
          400:  '#60C8EA',
          300:  '#A8DDEF',
        },
        gold: {
          900:  '#7C5A0D',
          700:  '#A8872A',
          500:  '#C9A84C',   // official Movv gold
          400:  '#D4B85A',
          300:  '#E8C96A',
          200:  '#F5E4A0',
          100:  '#FDF8ED',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      backgroundImage: {
        'movv-gradient': 'linear-gradient(135deg, #061C2E 0%, #0C2D48 60%, #1A4D7A 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(12,45,72,0.06) 0%, rgba(26,77,122,0.04) 100%)',
      },
      boxShadow: {
        'gold':    '0 0 20px rgba(201,168,76,0.25)',
        'gold-lg': '0 0 40px rgba(201,168,76,0.35)',
        'blue':    '0 4px 24px rgba(12,45,72,0.18)',
        'card':    '0 1px 4px rgba(0,0,0,0.07)',
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'float': 'float 4s ease-in-out infinite',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
