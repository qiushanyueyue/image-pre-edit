/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // 启用 class 策略的深色模式
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                slate: {
                    850: '#1e293b', // Custom dark shade
                    900: '#0f172a',
                },
                primary: {
                    DEFAULT: '#3b82f6',
                    hover: '#2563eb',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
