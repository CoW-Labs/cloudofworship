import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const colorClasses = [
  "text-[#FF355E]",
  "text-[#FD5B78]",
  "text-[#FF6037]",
  "text-[#FF9966]",
  "text-[#FF9933]",
  "text-[#FFCC33]",
  "text-[#0281FF]",
  "text-[#A7F432]",
  "text-[#a0c801]",
  "text-[#AAF0D1]",
  "text-[#50BFE6]",
  "text-[#FF6EFF]",
  "text-[#EE34D2]",
  "text-[#FF00CC]",
  "bg-[#FF355E20]",
  "bg-[#FD5B7820]",
  "bg-[#FF603720]",
  "bg-[#FF996620]",
  "bg-[#FF993320]",
  "bg-[#FFCC3320]",
  "bg-[#0281FF20]",
  "bg-[#A7F43220]",
  "bg-[#a0c80120]",
  "bg-[#AAF0D120]",
  "bg-[#50BFE620]",
  "bg-[#FF6EFF20]",
  "bg-[#EE34D220]",
  "bg-[#FF00CC20]",
  "border-[#FF355E]",
  "border-[#FD5B78]",
  "border-[#FF6037]",
  "border-[#FF9966]",
  "border-[#FF9933]",
  "border-[#FFCC33]",
  "border-[#0281FF]",
  "border-[#A7F432]",
  "border-[#a0c801]",
  "border-[#AAF0D1]",
  "border-[#50BFE6]",
  "border-[#FF6EFF]",
  "border-[#EE34D2]",
  "border-[#FF00CC]",
]

export default <Partial<Config>>{
  safelist: colorClasses,
  theme: {
    extend: {
      colors: {
        'purple': {
          '50': '#faf5ff',
          '100': '#f3e8ff',
          '200': '#e9d5ff',
          '300': '#d8b4fe',
          '400': '#c084fc',
          '500': '#a855f7',
          '600': '#9333ea',
          '700': '#7e22ce',
          '800': '#6b21a8',
          '900': '#581c87',
          '950': '#3b0764',
        },
      }
    }
  }
}
