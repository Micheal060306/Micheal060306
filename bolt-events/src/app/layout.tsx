import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Bolt Events', template: '%s | Bolt Events' }, description: 'Event appointments by Bolt Academy' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
export default function Root({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
