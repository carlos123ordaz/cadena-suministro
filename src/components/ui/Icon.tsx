const ICONS: Record<string, string> = {
  dashboard:  'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  opci:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  cart:       'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  ship:       'M3 18l1.7-1A4 4 0 016 17h12a4 4 0 011.3.22L21 18M5 13l7-9 7 9M9 13V8h6v5M3 21h18',
  coin:       'M12 8c-2.5 0-4 1-4 2.5S9.5 13 12 13s4 1 4 2.5S14.5 18 12 18m0-10v10m0-10c1.6 0 3 .5 3 1.5m-3 8.5c-1.6 0-3-.5-3-1.5M12 22a10 10 0 110-20 10 10 0 010 20z',
  invoice:    'M9 12h6m-6 4h4m1-12H7a2 2 0 00-2 2v14l3-2 3 2 3-2 3 2V6a2 2 0 00-2-2h-2',
  warehouse:  'M3 21V9l9-6 9 6v12M3 21h18M9 21v-8h6v8',
  truck:      'M3 17V7a1 1 0 011-1h10v11H3zm0 0h2a2 2 0 104 0h6a2 2 0 104 0h2v-5l-3-4h-3v6',
  users:      'M17 21v-2a4 4 0 00-3-3.87m-4 0A4 4 0 007 19v2M9 11a4 4 0 100-8 4 4 0 000 8zm10-1a3 3 0 11-6 0 3 3 0 016 0z',
  building:   'M3 21V5a2 2 0 012-2h6a2 2 0 012 2v16m-10 0h18M13 9h6a2 2 0 012 2v10M7 7h2m-2 4h2m-2 4h2m6 0h2m-2-4h2',
  box:        'M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7l8.7 5 8.7-5M12 22V12',
  chart:      'M3 3v18h18M7 14l3-3 4 4 6-6',
  cog:        'M10.3 3.3a1 1 0 011.4 0l1 1a1 1 0 00.7.3h1.4a1 1 0 011 1v1.4a1 1 0 00.3.7l1 1a1 1 0 010 1.4l-1 1a1 1 0 00-.3.7v1.4a1 1 0 01-1 1h-1.4a1 1 0 00-.7.3l-1 1a1 1 0 01-1.4 0l-1-1a1 1 0 00-.7-.3H7.2a1 1 0 01-1-1v-1.4a1 1 0 00-.3-.7l-1-1a1 1 0 010-1.4l1-1a1 1 0 00.3-.7V6.6a1 1 0 011-1h1.4a1 1 0 00.7-.3l1-1zM12 15a3 3 0 100-6 3 3 0 000 6z',
  search:     'M21 21l-4.3-4.3M19 11a8 8 0 11-16 0 8 8 0 0116 0z',
  bell:       'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0',
  plus:       'M12 5v14M5 12h14',
  filter:     'M3 5h18M6 12h12M10 19h4',
  chevron:    'M9 6l6 6-6 6',
  chevronDown:'M6 9l6 6 6-6',
  chevronUp:  'M18 15l-6-6-6 6',
  more:       'M12 5v.01M12 12v.01M12 19v.01',
  download:   'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16',
  upload:     'M12 20V8m0 0l-4 4m4-4l4 4M4 4h16',
  paperclip:  'M21 12.5L12.5 21a5.5 5.5 0 11-7.8-7.8l8.5-8.5a4 4 0 015.6 5.6l-8.5 8.5a2.5 2.5 0 11-3.5-3.5L13.4 8',
  check:      'M5 13l4 4L19 7',
  x:          'M6 6l12 12M18 6L6 18',
  warning:    'M12 9v4m0 4v.01M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  clock:      'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
  arrow:      'M5 12h14m0 0l-6-6m6 6l-6 6',
  arrowDown:  'M19 9l-7 7-7-7',
  arrowUp:    'M5 15l7-7 7 7',
  globe:      'M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9 9 4 9 9zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  pin:        'M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12zm0-9a3 3 0 100-6 3 3 0 000 6z',
  doc:        'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zm0 0v6h6',
  history:    'M3 12a9 9 0 109-9M3 12H1m2 0l3-3M12 7v5l3 2',
  comment:    'M21 12c0 4.4-4 8-9 8a10 10 0 01-4-.8L3 21l1-4.3A8 8 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z',
  link:       'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  refresh:    'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
  edit:       'M4 20h4l10-10-4-4L4 16v4zm10-14l4 4',
  eye:        'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z',
  trash:      'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z',
  save:       'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  close:      'M6 6l12 12M18 6L6 18',
  arrowLeft:  'M19 12H5m0 0l7 7m-7-7l7-7',
  spinner:    'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  package:    'M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  tag:        'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
  layers:     'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  dollar:     'M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6',
}

interface IconProps {
  name: string
  size?: number
  stroke?: number
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 16, stroke = 1.6, className, style }: IconProps) {
  const d = ICONS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={d} />
    </svg>
  )
}
