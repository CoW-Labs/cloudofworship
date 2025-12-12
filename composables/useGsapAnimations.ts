import { gsap } from 'gsap'
import CustomEase from 'gsap/CustomEase'

export const useGsapAnimations = () => {
  // Register GSAP plugins
  gsap.registerPlugin(CustomEase)

  try {
    CustomEase.create('cb', '0.22,1,0.36,1')
  } catch (e) {
    // fallback: if CustomEase.create fails silently, ignore
  }

  /**
   * Animate gradient color stops
   */
  const animateGradientStops = (
    colorStops: { pos: number; color: string }[],
    targetConfig: Record<string, number>,
    duration: number,
    onUpdate: () => void,
    onComplete?: () => void
  ) => {
    const targetStops = Object.entries(targetConfig).map(([color, pos]) => ({ color, pos }))
    const proxies = colorStops.map((s) => ({ pos: s.pos }))

    proxies.forEach((proxy, i) => {
      gsap.to(proxy, {
        pos: targetStops[i].pos,
        duration,
        ease: 'power2.inOut',
        onUpdate() {
          colorStops[i].pos = proxy.pos
          onUpdate()
        },
        onComplete() {
          if (i === proxies.length - 1 && onComplete) {
            onComplete()
          }
        }
      })
    })
  }

  /**
   * Blur-in animation for elements
   */
  const blurIn = (
    element: HTMLElement | HTMLElement[],
    options: {
      duration?: number
      delay?: number
      stagger?: number
      ease?: string
      onComplete?: () => void
    } = {}
  ) => {
    const {
      duration = 1,
      delay = 0,
      stagger = 0,
      ease = 'power2.out',
      onComplete
    } = options

    return gsap.fromTo(
      element,
      {
        opacity: 0,
        filter: 'blur(20px)',
        y: 30
      },
      {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        duration,
        delay,
        stagger,
        ease,
        onComplete
      }
    )
  }

  /**
   * Blur-out animation for elements
   */
  const blurOut = (
    element: HTMLElement | HTMLElement[],
    options: {
      duration?: number
      delay?: number
      stagger?: number
      ease?: string
      onComplete?: () => void
    } = {}
  ) => {
    const {
      duration = 0.6,
      delay = 0,
      stagger = 0,
      ease = 'power2.in',
      onComplete
    } = options

    return gsap.to(element, {
      opacity: 0,
      filter: 'blur(20px)',
      y: -30,
      duration,
      delay,
      stagger,
      ease,
      onComplete
    })
  }

  /**
   * Infinite horizontal scroll animation
   */
  const infiniteScroll = (
    element: HTMLElement,
    options: {
      direction?: 'left' | 'right'
      duration?: number
      distance?: number
    } = {}
  ) => {
    const {
      direction = 'left',
      duration = 40,
      distance = 0
    } = options

    const scrollDistance = distance || element.scrollWidth / 2

    if (direction === 'left') {
      return gsap.fromTo(
        element,
        { x: 0 },
        {
          x: -scrollDistance,
          duration,
          ease: 'none',
          repeat: -1
        }
      )
    } else {
      return gsap.fromTo(
        element,
        { x: -scrollDistance },
        {
          x: 0,
          duration,
          ease: 'none',
          repeat: -1
        }
      )
    }
  }

  /**
   * Create gradient string from color stops
   */
  const makeGradient = (stops: { pos: number; color: string }[]) => {
    const s = stops.map((p) => `${p.color} ${p.pos}%`).join(', ')
    return `linear-gradient(45deg, ${s})`
  }

  /**
   * Kill all animations for cleanup
   */
  const killAnimations = (...animations: (gsap.core.Tween | gsap.core.Timeline | null)[]) => {
    animations.forEach((anim) => {
      if (anim) anim.kill()
    })
  }

  return {
    animateGradientStops,
    blurIn,
    blurOut,
    infiniteScroll,
    makeGradient,
    killAnimations,
    gsap
  }
}
