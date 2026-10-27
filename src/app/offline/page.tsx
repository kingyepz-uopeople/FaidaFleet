'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#1e3a5f] text-white text-3xl font-bold shadow-lg">
          FF
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re offline</h1>
        <p className="text-gray-500 mb-8">
          FaidaFleet can&apos;t reach the internet right now. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-full bg-[#1e3a5f] px-8 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#16305a] transition-colors active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
