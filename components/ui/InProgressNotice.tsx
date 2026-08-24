export function InProgressNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="hairline-t hairline-b py-8 mt-16 max-w-2xl">
      <p className="font-mono-label text-ink-faint">{children}</p>
    </div>
  );
}
