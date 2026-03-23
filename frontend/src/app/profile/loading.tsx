function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Pulse className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Pulse className="h-5 w-32" />
          <Pulse className="h-3 w-48" />
        </div>
      </div>
      {/* Cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
          <Pulse className="h-5 w-28" />
          <Pulse className="h-10 w-full" />
          <Pulse className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
