export function LoadingScreen() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[var(--soft)] text-[var(--text)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-6 py-5 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <span className="text-sm font-medium">Carregando seu espaço...</span>
      </div>
    </main>
  )
}
