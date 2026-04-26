import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // Root index.html files
    path.join(__dirname, 'index.html'),
    // All source files — covers portals, shared, components
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    // Portal-specific index.html files
    path.join(__dirname, 'src/portals/**/*.html'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
  safelist: [
    { pattern: /bg-(violet|blue|slate|emerald|indigo|orange|rose)-(50|100|600|700|800|900|950)/ },
    { pattern: /text-(violet|blue|slate|emerald|indigo|orange|rose)-(100|200|600|700|800|900)/ },
    { pattern: /border-(violet|blue|slate|emerald|indigo|orange|rose)-(100|200|700|800)/ },
    { pattern: /from-(violet|blue|slate|emerald|indigo|orange|rose)-(500|600|700)/ },
    { pattern: /to-(violet|blue|slate|emerald|indigo|orange|rose)-(700|800|900)/ },
    { pattern: /hover:bg-(violet|blue|slate|emerald|indigo|orange|rose)-(700|800)/ },
  ],
};
