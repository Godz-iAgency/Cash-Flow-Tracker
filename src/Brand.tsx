export function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true"><img src="/icons/icon-192.png" alt="" width="192" height="192" /></span>;
}
