import localFont from 'next/font/local'

// Foundation §7.2: vendored, variable, swapped in over the system fallback.
// Latin glyphs are built in, so a brand name never falls to a second face.
export const vazirmatn = localFont({
  src: './fonts/Vazirmatn[wght].woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-vazirmatn',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
})
