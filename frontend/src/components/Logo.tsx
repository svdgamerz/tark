// Tark's logo — the Bloom: six swirled petals turning around an open centre.
// A mandala/chakra-rooted emblem in the modern AI-mark family. Uses currentColor,
// so it inherits the surrounding text color and flips cleanly in dark mode.
const PETALS = [0, 60, 120, 180, 240, 300]

export function Logo({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="Tark"
    >
      {PETALS.map((a) => (
        <ellipse
          key={a}
          cx={32}
          cy={17}
          rx={6.8}
          ry={13}
          transform={`rotate(${a} 32 32) rotate(28 32 17)`}
        />
      ))}
    </svg>
  )
}
