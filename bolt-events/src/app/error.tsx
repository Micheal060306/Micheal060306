'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <div className="auth"><div className="card stack"><h1>Something went wrong</h1><p className="muted">This page could not be loaded. Please try again.</p><button className="btn" onClick={reset}>Try again</button></div></div>;
}
