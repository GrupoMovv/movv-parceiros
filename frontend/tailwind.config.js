/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        movv: {
          950:  '#1D0547',
          900:  '#4A0E8F',   // brand primary — sidebar, header, buttons
          850:  '#420D82',
          800:  '#3C0973',   // darker — hover states
          750:  '#520DA0',
          700:  '#6B21C8',   // borders on dark bg
          600:  '#7C3AED',
          500:  '#9333EA',
          400:  '#A855F7',
          300:  '#C4B5FD',
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
      },
      backgroundImage: {
        'movv-gradient': 'linear-gradient(135deg, #2D0464 0%, #4A0E8F 60%, #3C0973 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(74,14,143,0.06) 0%, rgba(60,9,115,0.04) 100%)',
      },
      boxShadow: {
        'gold':    '0 0 20px rgba(201,168,76,0.25)',
        'gold-lg': '0 0 40px rgba(201,168,76,0.35)',
        'purple':  '0 4px 24px rgba(74,14,143,0.18)',
        'card':    '0 1px 4px rgba(0,0,0,0.07)',
      },
    },
  },
  plugins: [],
};
