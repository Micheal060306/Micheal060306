/**
 * Recreation of the Zeralytics mark (arrow + ribbon, gold-to-violet gradient)
 * for use until the source logo file is supplied. Swap this for an <Image>
 * pointing at /public/logo.svg (or .png) once the real asset is added —
 * proportions and colors were matched by eye from the reference image, not
 * traced from the original vector.
 */
export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3c968" />
          <stop offset="100%" stopColor="#c4922a" />
        </linearGradient>
        <linearGradient id="logoViolet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ab97e6" />
          <stop offset="100%" stopColor="#6c55b8" />
        </linearGradient>
      </defs>
      <path
        d="M27,63 C44,55 57,76 78,70 C90,66 87,53 76,55 C61,58 56,44 39,48 C27,50 22,57 27,63 Z"
        fill="url(#logoViolet)"
      />
      <g transform="rotate(-45 53 45)">
        <rect x="47" y="30" width="12" height="42" rx="6" fill="url(#logoGold)" />
        <polygon points="30,32 76,32 53,6" fill="url(#logoGold)" />
        <line x1="63" y1="66" x2="80" y2="66" stroke="url(#logoGold)" strokeWidth="4" strokeLinecap="round" />
        <line x1="63" y1="75" x2="76" y2="75" stroke="url(#logoGold)" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      </g>
    </svg>
  );
}
