// Smart Enterprise Suite - Brand Colors from Branding.pdf

export const smartBrandColors = {
  // Primary Blues (from logo)
  primary: {
    DEFAULT: '#0A2472', // Deep Navy Blue
    50: '#E8EBF5',
    100: '#D1D7EB',
    200: '#A3AFD7',
    300: '#7587C3',
    400: '#475FAF',
    500: '#0A2472',  // Main
    600: '#081D5B',
    700: '#061644',
    800: '#040F2D',
    900: '#020816',
  },
  
  // Accent Colors from palette
  accent: {
    cyan: '#6CE4F0',      // PANTONE 2727 C
    purple: '#7E5BAB',    // PANTONE 525 C / 674 C
    pink: '#C85C8E',      // PANTONE 674 C
    orange: '#E86B3A',    // PANTONE 7578 C / 141 C
    yellow: '#F5C451',    // PANTONE 141 C
    green: '#80C646',     // PANTONE 367 C / Green 0921 C
    teal: '#31625C',      // PANTONE 555 C / 7635 C
  },

  // Gradients from design
  gradient: {
    purpleBlue: 'linear-gradient(135deg, #5536A7 0%, #0A2472 100%)',
    blueGreen: 'linear-gradient(135deg, #0A2472 0%, #31625C 100%)',
    orangePink: 'linear-gradient(135deg, #E86B3A 0%, #C85C8E 100%)',
    multicolor: 'linear-gradient(135deg, #C85C8E 0%, #5536A7 25%, #0A2472 50%, #31625C 75%, #80C646 100%)',
  },

  // Semantic Colors
  success: '#80C646',
  warning: '#F5C451',
  error: '#E86B3A',
  info: '#6CE4F0',
};

export const smartTheme = {
  colors: smartBrandColors,
  
  fonts: {
    sans: ['Inter', 'IBM Plex Sans Arabic', 'sans-serif'],
    heading: ['Inter', 'sans-serif'],
  },
  
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem',  // 64px
  },
  
  borderRadius: {
    sm: '0.5rem',   // 8px
    md: '0.75rem',  // 12px
    lg: '1rem',     // 16px
    xl: '1.5rem',   // 24px
    '2xl': '2rem',  // 32px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    glow: '0 0 20px rgba(108, 228, 240, 0.3)',
  },
};
