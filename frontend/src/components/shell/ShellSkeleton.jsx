export default function ShellSkeleton({ lines = 3, compact = false }) {
  return (
    <div className={`space-y-3 ${compact ? 'max-w-sm' : ''}`}>
      <div className="skeleton h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className={`skeleton h-3 ${index === lines - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  )
}
