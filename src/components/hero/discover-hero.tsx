import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { HeroFallback } from '@/components/hero/hero-fallback'
import { MediaImage } from '@/components/shared/media-image'
import { AnimatedValue } from '@/components/shared/animated-value'
import { Button } from '@/components/ui/button'
import { catalog } from '@/data/catalog'
import { getCollectionById } from '@/data/selectors'
import { ease, rise, stagger } from '@/lib/motion'

const HeroCanvas = lazy(() => import('@/components/hero/hero-canvas'))


function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <HeroFallback reason="3D unavailable — static scene" />
    }
    return this.props.children
  }
}


export function DiscoverHero() {
  const featured = catalog.campaigns[0]
  const featuredCollection = getCollectionById(featured.collectionId)
  // Probe once. Reduced motion is handled inside the canvas (one static frame),
  // so the 3D scene is still shown to those users, just without movement.
  const [use3d] = useState(webglAvailable)

  const stats = [
    { label: 'Collections', value: catalog.collections.length },
    { label: 'Tokens', value: catalog.tokens.length },
    { label: 'Networks', value: catalog.networks.length },
  ]

  return (
    <section className="nx-hero relative isolate grid items-stretch lg:grid-cols-[1.05fr_0.95fr]">
      <motion.div
        variants={stagger(0.07, 0.04)}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col justify-between gap-8 px-6 py-7 md:px-8 md:py-8 xl:px-10 xl:py-9"
      >
        <div>
          <motion.p variants={rise} className="nx-kicker flex items-center gap-2.5">
            <span className="nx-live-dot" />
            Multi-chain observatory
          </motion.p>
          <motion.h1
            variants={rise}
            className="mt-4 max-w-lg font-display text-[clamp(2rem,3.5vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-ink"
          >
            Culture, <span className="bg-gradient-to-r from-copper to-sage bg-clip-text text-transparent">priced in public.</span>
          </motion.h1>
          <motion.p variants={rise} className="mt-4 max-w-md text-[14px] leading-6 text-mute">
            NEXORA is a demo discovery desk for collections, tokens, and studios across six networks.
            Figures are labeled mock data — no wallets, no swaps.
          </motion.p>
          <motion.div variants={rise} className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild className="nx-hero-cta nx-hero-cta--primary group/cta">
              <Link to="/collections">
                <span>Browse collections</span>
                <ArrowRight className="nx-hero-cta__arrow size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="nx-hero-cta nx-hero-cta--secondary group/cta">
              <Link to={`/collections/${catalog.collections[0].slug}`}>
                <span>{featured.title}</span>
                <ArrowUpRight className="nx-hero-cta__arrow size-4" aria-hidden="true" />
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.dl variants={rise} className="grid max-w-sm grid-cols-3 border-t border-line/80 pt-4">
          {stats.map((stat, i) => (
            <div key={stat.label} className={i > 0 ? 'border-l border-line/70 pl-4' : undefined}>
              <dd className="font-mono text-[20px] leading-none tabular-nums text-ink"><AnimatedValue value={stat.value} format="padded" /></dd>
              <dt className="nx-eyebrow mt-1.5 text-[9.5px]">{stat.label}</dt>
            </div>
          ))}
        </motion.dl>
      </motion.div>

      <div className="nx-hero-scene relative min-h-[290px] overflow-hidden sm:min-h-[330px] lg:min-h-[400px]">
        {use3d ? (
          <SceneBoundary>
            <Suspense fallback={<HeroFallback reason="Preparing 3D scene" />}>
              <div className="nx-canvas-wrap absolute inset-0">
                <HeroCanvas />
              </div>
            </Suspense>
          </SceneBoundary>
        ) : (
          <HeroFallback reason="WebGL unavailable" />
        )}

        {/* Featured drop: a real link, anchored low-right so it frames the sphere instead of covering it. */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.55 }}
          className="absolute bottom-3.5 right-3.5 z-10 sm:bottom-4 sm:right-4"
        >
          <Link
            to={featuredCollection ? `/collections/${featuredCollection.slug}` : '/collections'}
            className="group flex items-center gap-3 rounded-xl border border-line/90 bg-canvas/70 p-2 pr-3.5 backdrop-blur-md transition-colors hover:border-copper/40"
          >
            <span className="block size-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
              <MediaImage src={featured.cover} alt={featured.title} fallbackLabel="DR" priority />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-gain">
                <span className="nx-live-dot" />
                {featured.status === 'live' ? 'Live drop' : 'Next drop'}
              </span>
              <span className="mt-0.5 block max-w-[10rem] truncate text-[12.5px] font-medium text-ink">{featured.title}</span>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-mute transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
