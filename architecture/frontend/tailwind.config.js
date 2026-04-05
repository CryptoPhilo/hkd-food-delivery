module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ── Airbnb Design Tokens ── */
      colors: {
        // Brand
        'airbnb-red': '#ff385c',
        'airbnb-red-dark': '#e00b41',
        // Text
        'airbnb-black': '#222222',
        'airbnb-gray': '#6a6a6a',
        'airbnb-gray-light': '#717171',
        'airbnb-disabled': 'rgba(0,0,0,0.24)',
        // Surfaces
        'airbnb-bg': '#ffffff',
        'airbnb-surface': '#f2f2f2',
        'airbnb-border': '#c1c1c1',
        'airbnb-divider': '#ebebeb',
        // Semantic
        'airbnb-green': '#008A05',
        'airbnb-green-bg': '#E8F5E9',
        'airbnb-yellow-bg': '#FFF8E1',
        'airbnb-yellow-text': '#F57F17',
        'airbnb-purple-bg': '#F3E5F5',
        'airbnb-purple-text': '#7B1FA2',
        'airbnb-blue-bg': '#E3F2FD',
        'airbnb-blue-text': '#1565C0',
        'airbnb-error': '#c13515',
      },
      borderRadius: {
        'airbnb-sm': '8px',
        'airbnb-md': '14px',
        'airbnb-lg': '20px',
        'airbnb-xl': '32px',
      },
      boxShadow: {
        'airbnb-card': 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px',
        'airbnb-hover': 'rgba(0,0,0,0.08) 0px 4px 12px',
        'airbnb-focus': '0 0 0 2px #222222',
      },
      fontFamily: {
        'airbnb': ['-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      letterSpacing: {
        'airbnb-tight': '-0.44px',
        'airbnb-snug': '-0.18px',
      },
    },
  },
  plugins: [],
}
