interface AppLogoProps {
  size?: number
}

export function AppLogo({ size = 22 }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect width="32" height="32" rx="7" fill="#1e293b" />
      <rect width="32" height="32" rx="7" fill="url(#logo-shine)" opacity="0.18" />

      {/* Chain spine */}
      <line x1="22" y1="8" x2="10" y2="24" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" />

      {/* Node — bottom-left (supplier) */}
      <path d="M10 21 L13 24 L10 27 L7 24Z" fill="#1d4ed8" />
      <path d="M10 22.8 L11.2 24 L10 25.2 L8.8 24Z" fill="#93c5fd" />

      {/* Node — center / hub */}
      <path d="M16 12.5 L19.5 16 L16 19.5 L12.5 16Z" fill="#2563eb" />
      <path d="M16 14.5 L17.5 16 L16 17.5 L14.5 16Z" fill="#ffffff" />

      {/* Node — top-right (customer) */}
      <path d="M22 5 L25 8 L22 11 L19 8Z" fill="#1d4ed8" />
      <path d="M22 6.8 L23.2 8 L22 9.2 L20.8 8Z" fill="#93c5fd" />

      <defs>
        <linearGradient id="logo-shine" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#000000" />
        </linearGradient>
      </defs>
    </svg>
  )
}
