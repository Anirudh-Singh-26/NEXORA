/**
 * Stable CSS-only placeholder for the WebGL observatory.
 * Keep this visually close to the actual canvas so the featured collection
 * artwork never flashes large behind the Live Drop chip while Three.js loads.
 */
export function HeroFallback({ reason }: { reason?: string }) {
  return (
    <div
      className="nx-hero-fallback absolute inset-0 overflow-hidden bg-[#080a18]"
      role="img"
      aria-label={reason ?? 'NEXORA observatory scene'}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_43%,rgba(66,52,177,0.2),transparent_48%),radial-gradient(ellipse_at_52%_55%,rgba(31,174,208,0.08),transparent_58%)]" />
      <div className="absolute left-1/2 top-[43%] size-[clamp(150px,24vw,260px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/40 bg-[radial-gradient(circle_at_65%_30%,rgba(143,119,255,0.34),rgba(23,20,76,0.92)_48%,rgba(4,15,39,0.98)_76%)] shadow-[inset_10px_-8px_24px_rgba(46,212,238,0.22),inset_-12px_6px_28px_rgba(139,108,255,0.4),0_0_28px_rgba(83,72,255,0.24)]">
        <div className="absolute inset-[10%] rounded-full border border-violet-300/20" />
        <div className="absolute inset-x-[4%] top-[22%] h-[56%] rounded-[50%] border border-violet-300/20" />
        <div className="absolute inset-y-[3%] left-[31%] w-[38%] rounded-[50%] border border-violet-300/20" />
        <div className="absolute inset-y-[3%] left-[8%] w-[84%] rounded-[50%] border border-cyan-300/20" />
      </div>
      <div className="absolute left-1/2 top-[43%] h-[24%] w-[min(78%,520px)] -translate-x-1/2 -translate-y-1/2 rotate-[-10deg] rounded-[50%] border border-cyan-300/60" />
      <div className="absolute left-1/2 top-[43%] h-[35%] w-[min(62%,390px)] -translate-x-1/2 -translate-y-1/2 rotate-[54deg] rounded-[50%] border border-violet-300/50" />
      <span className="absolute left-[calc(50%+clamp(80px,12vw,130px))] top-[calc(43%-2px)] size-2 rounded-full bg-cyan-100 shadow-[0_0_12px_3px_rgba(79,216,234,0.7)]" />
      <span className="absolute left-[calc(50%-clamp(90px,13vw,140px))] top-[calc(43%+clamp(65px,11vw,115px))] size-3 rounded-full bg-violet-500 shadow-[0_0_14px_4px_rgba(139,108,255,0.55)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#080a18]/50" />
    </div>
  )
}
