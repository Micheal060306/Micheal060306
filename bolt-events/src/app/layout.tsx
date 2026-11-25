import '@fontsource-variable/dm-sans';
import '@fontsource/exo-2/700.css';
import '@fontsource/exo-2/800.css';
import '@fontsource/exo-2/900.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Bolt Events', template: '%s | Bolt Events' }, description: 'Event appointments by Bolt Academy' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' };
export default function Root({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
