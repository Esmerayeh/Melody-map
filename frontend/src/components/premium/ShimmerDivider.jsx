export default function ShimmerDivider({ className = '' }) {
  return <div className={`shimmer-divider ${className}`.trim()} aria-hidden="true" />
}
