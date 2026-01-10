export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      aria-label="Conundrum logo"
    >
      {/* Top-left */}
      <path d="M3 47 A47 47 0 0 1 47 3 C 47 25, 25 47, 3 47 Z" />
      {/* Top-right */}
      <path d="M53 3 A47 47 0 0 1 97 47 C 75 47, 53 25, 53 3 Z" />
      {/* Bottom-right */}
      <path d="M97 53 A47 47 0 0 1 53 97 C 53 75, 75 53, 97 53 Z" />
      {/* Bottom-left */}
      <path d="M47 97 A47 47 0 0 1 3 53 C 25 53, 47 75, 47 97 Z" />
    </svg>
  )
}
