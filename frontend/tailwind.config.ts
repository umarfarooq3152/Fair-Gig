import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['FairGig Text', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        mint: {
          500: '#00d1ff',
          600: '#00b8e6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
