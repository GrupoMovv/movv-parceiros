/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        movv: {
          950:  '#07030f',
          900:  '#0d0619',
          850:  '#120820',
          800:  '#1a0b2e',
          750:  '#210e3a',
          700:  '#2d1054',
          600:  '#3d1870',
          500:  '#6b21a8',
          400:  '#9333ea',
          300:  '#c084fc',
        },
        gold: {
          900:  '#6b5205',
          700:  '#a07708',
          500:  '#d4af37',
          400:  '#e8c84a',
          300:  '#f5d860',
          200:  '#fde68a',
          100:  '#fef9c3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'movv-gradient': 'linear-gradient(135deg, #0d0619 0%, #1a0b2e 50%, #210e3a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #d4af37 0%, #f5d860 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(45,16,84,0.8) 0%, rgba(26,11,46,0.9) 100%)',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(212,175,55,0.25)',
        'gold-lg': '0 0 40px rgba(212,175,55,0.35)',
        'purple': '0 0 20px rgba(107,33,168,0.4)',
      },
    },
  },
  plugins: [],
};
