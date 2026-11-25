import Link from 'next/link';
/** Bolt Academy logo plus an "Events" tag. Use onLight on white surfaces (dark-ink version of the logo). */
export function Brand({ href = '/events', onLight = false }: { href?: string; onLight?: boolean }) {
  return <Link className={`brand${onLight ? ' on-light' : ''}`} href={href} aria-label="Bolt Academy Events, home"><img src={onLight ? '/bolt-logo-dark.png' : '/bolt-logo.png'} alt="Bolt Academy" width={68} height={38} /><span className="brand-tag">Events</span></Link>;
}
