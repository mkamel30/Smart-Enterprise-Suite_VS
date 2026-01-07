/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Smart Enterprise Suite Brand Colors
                brand: {
                    primary: '#0A2472',      // Deep Navy Blue
                    cyan: '#6CE4F0',         // PANTONE 2727 C
                    purple: '#7E5BAB',       // PANTONE 525 C
                    pink: '#C85C8E',         // PANTONE 674 C
                    orange: '#E86B3A',       // PANTONE 7578 C
                    yellow: '#F5C451',       // PANTONE 141 C
                    green: '#80C646',        // PANTONE 367 C
                    teal: '#31625C',         // PANTONE 555 C
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            fontFamily: {
                sans: ["Inter", "var(--font-arabic)", "sans-serif"],
                inter: ["Inter", "sans-serif"],
                arabic: ["var(--font-arabic)", "sans-serif"],
            },
            backgroundImage: {
                'gradient-smart-purple': 'linear-gradient(135deg, #5536A7 0%, #0A2472 100%)',
                'gradient-smart-blue': 'linear-gradient(135deg, #0A2472 0%, #31625C 100%)',
                'gradient-smart-warm': 'linear-gradient(135deg, #E86B3A 0%, #C85C8E 100%)',
                'gradient-smart-rainbow': 'linear-gradient(135deg, #C85C8E 0%, #5536A7 25%, #0A2472 50%, #31625C 75%, #80C646 100%)',
            },
            boxShadow: {
                'smart-glow': '0 0 20px rgba(108, 228, 240, 0.3)',
                'smart-card': '0 10px 15px -3px rgba(10, 36, 114, 0.1)',
            },
        },
    },
    plugins: [],
}
