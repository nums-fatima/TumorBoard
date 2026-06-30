export default function SidebarToggleIcon({ side = 'left' }: { side?: 'left' | 'right' }) {
  return (
    <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <line x1={side === 'left' ? 7.5 : 12.5} y1="3.5" x2={side === 'left' ? 7.5 : 12.5} y2="16.5" />
    </svg>
  )
}
