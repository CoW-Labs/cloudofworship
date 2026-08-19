import type { Config, Driver, DriveStep, Popover, PopoverDOM } from "driver.js"
import { onboardingSteps, type TourStep } from "~/utils/onboardingSteps"
import { useAuthStore } from "~/store/auth"

/** driver.js doesn't export its hook-options type, so borrow it from the hook. */
type PopoverHookOpts = Parameters<NonNullable<Popover["onPopoverRender"]>>[1]

const STORAGE_KEY = "cow_onboarding_tour"

interface TourProgress {
  completedAt?: string
  lastStepId?: string
}

type StoredProgress = Record<string, TourProgress>

const readProgress = (): StoredProgress => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const writeProgress = (userId: string, patch: TourProgress) => {
  try {
    const all = readProgress()
    all[userId] = { ...all[userId], ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Ignore storage failures (private mode, quota, SecurityError).
  }
}

/**
 * Drives the operator-window product tour.
 *
 * driver.js owns the overlay, spotlight and positioning; the popover's markup
 * is rebuilt per step so it matches the product's card styling (header bar +
 * nested body card) rather than driver's stock layout.
 *
 * Deliberately NOT stored in `appStore.currentState` — that state is mirrored
 * into the live projection window by pinia-shared-state, and the tour must
 * never appear on the projector.
 */
export const useOnboardingTour = () => {
  const authStore = useAuthStore()

  const isWelcomeOpen = ref(false)
  const isRunning = ref(false)

  let driverObj: Driver | null = null

  const userKey = () => authStore.user?._id || "anonymous"

  const hasCompletedTour = () => !!readProgress()[userKey()]?.completedAt

  /* ------------------------------------------------------------ spotlight -- */

  /**
   * Padding between the highlighted element and the ring, in px. Kept smaller
   * than `stagePadding` so the ring always lands inside the overlay's cutout.
   */
  const RING_INSET = 6

  let ringEl: HTMLDivElement | null = null

  /**
   * The spotlight ring is a fixed-position element rather than an `outline` on
   * the target, because several anchors sit inside `overflow: hidden` panels
   * that would clip an outline.
   */
  const positionRing = () => {
    const element = driverObj?.getActiveElement()
    if (!element || !ringEl) return

    const rect = element.getBoundingClientRect()
    ringEl.style.left = `${rect.left - RING_INSET}px`
    ringEl.style.top = `${rect.top - RING_INSET}px`
    ringEl.style.width = `${rect.width + RING_INSET * 2}px`
    ringEl.style.height = `${rect.height + RING_INSET * 2}px`
    ringEl.style.opacity = "1"
  }

  const mountRing = () => {
    if (ringEl) return
    ringEl = document.createElement("div")
    ringEl.className = "cow-tour-ring"
    document.body.appendChild(ringEl)
    window.addEventListener("resize", positionRing)
    window.addEventListener("scroll", positionRing, true)
  }

  const unmountRing = () => {
    window.removeEventListener("resize", positionRing)
    window.removeEventListener("scroll", positionRing, true)
    ringEl?.remove()
    ringEl = null
  }

  /* ----------------------------------------------------------------- gate -- */

  let gateTimer: number | null = null

  const clearGate = () => {
    if (gateTimer !== null) {
      window.clearInterval(gateTimer)
      gateTimer = null
    }
  }

  /**
   * Hold "Next" closed until the step's requirement is actually met. Polling
   * beats a MutationObserver here: the condition is "does this anchor exist",
   * the check is a single querySelector, and it can't miss an intermediate
   * state the way a filtered observer can.
   */
  const applyGate = (popover: PopoverDOM, step: TourStep) => {
    if (!step.requires) return

    const { selector, hint } = step.requires

    const hintEl = document.createElement("p")
    hintEl.className = "cow-tour-hint"
    hintEl.textContent = hint
    popover.nextButton.parentElement?.insertBefore(hintEl, popover.nextButton)

    const evaluate = () => {
      const met = !!document.querySelector(selector)
      popover.nextButton.disabled = !met
      popover.nextButton.classList.toggle("cow-tour-btn-disabled", !met)
      hintEl.style.display = met ? "none" : "block"
    }

    evaluate()
    gateTimer = window.setInterval(evaluate, 400)
  }

  /* -------------------------------------------------------------- popover -- */

  /**
   * Rebuild driver's popover into the product's card layout.
   *
   * The original button elements are MOVED rather than recreated: driver binds
   * a single delegated click handler on the wrapper that matches on the
   * `driver-popover-*-btn` classes, so keeping the nodes keeps navigation
   * working without re-wiring anything.
   */
  const renderPopover = (
    popover: PopoverDOM,
    opts: PopoverHookOpts,
    step: TourStep
  ) => {
    const {
      wrapper,
      title,
      description,
      progress,
      nextButton,
      previousButton,
      closeButton,
      footer,
    } = popover

    // driver builds fresh popover DOM per step, but guard anyway so a repeated
    // hook call can't leave orphaned wrappers behind.
    if (wrapper.querySelector(".cow-tour-body")) return

    clearGate()
    footer.style.display = "none"

    const header = document.createElement("div")
    header.className = "cow-tour-header"
    header.appendChild(title)
    header.appendChild(closeButton)
    closeButton.style.display = "grid"

    const body = document.createElement("div")
    body.className = "cow-tour-body"

    progress.style.display = "block"
    body.appendChild(progress)
    body.appendChild(description)

    const actions = document.createElement("div")
    actions.className = "cow-tour-actions"

    // First step has nothing to go back to, so the button would only be noise.
    previousButton.style.display = opts.driver.isFirstStep() ? "none" : "inline-flex"
    nextButton.style.display = "inline-flex"
    actions.appendChild(previousButton)
    actions.appendChild(nextButton)
    body.appendChild(actions)

    wrapper.insertBefore(body, footer)
    wrapper.insertBefore(header, body)

    applyGate(popover, step)
  }

  /* ---------------------------------------------------------- interaction -- */

  /**
   * Steps that ask the operator to *do* something need the whole app clickable,
   * not just the spotlit element — creating a Bible slide may mean using the
   * search bar first.
   */
  const setInteractive = (interactive: boolean) => {
    document.documentElement.classList.toggle("cow-tour-interactive", interactive)
  }

  /* --------------------------------------------------------------- driver -- */

  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !driverObj?.isActive()) return
    event.stopPropagation()
    driverObj.destroy()
  }

  const finish = (completed: boolean) => {
    isRunning.value = false
    clearGate()
    unmountRing()
    setInteractive(false)
    window.removeEventListener("keydown", onEscape, true)
    if (completed) {
      writeProgress(userKey(), { completedAt: new Date().toISOString() })
    }
  }

  /**
   * Start the highlighted walkthrough. Assumes the operator UI is mounted.
   */
  const startTour = async () => {
    if (import.meta.server) return

    const { driver } = await import("driver.js")

    // Steps are NOT pre-filtered against the DOM: the editor steps only exist
    // once a slide is open, which is exactly what the gated step arranges.
    // `skipMissingElement` resolves each anchor at the moment it's reached.
    const steps: DriveStep[] = onboardingSteps.map((step) => ({
      element: `[data-tour="${step.anchor}"]`,
      disableActiveInteraction: !step.interactive,
      popover: {
        title: step.title,
        description: step.body,
        side: step.side ?? "right",
        align: step.align ?? "start",
        onPopoverRender: (popover, opts) => renderPopover(popover, opts, step),
      },
      onHighlightStarted: () => {
        writeProgress(userKey(), { lastStepId: step.id })
        setInteractive(!!step.interactive)
      },
      onHighlighted: () => positionRing(),
    }))

    const config: Config = {
      steps,
      showProgress: true,
      progressText: "{{current}}/{{total}}",
      showButtons: ["previous", "next", "close"],
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      popoverClass: "cow-tour-popover",
      popoverOffset: 14,
      stagePadding: 12,
      stageRadius: 14,
      overlayColor: "#05070d",
      overlayOpacity: 0.72,
      allowClose: true,
      // A misclick on the overlay mid-tour shouldn't silently skip a step.
      overlayClickBehavior: "close",
      // Arrow keys belong to the app here — the tour itself teaches them as the
      // verse/page navigation shortcuts, so driver must not swallow them.
      allowKeyboardControl: false,
      smoothScroll: true,
      skipMissingElement: true,
      waitForElement: 1500,
      onDestroyed: () => finish(false),
      onDoneClick: () => {
        finish(true)
        driverObj?.destroy()
      },
    }

    driverObj = driver(config)
    isRunning.value = true
    mountRing()
    window.addEventListener("keydown", onEscape, true)
    driverObj.drive()
  }

  /**
   * Open the welcome card — the entry point the floating help button uses.
   */
  const openWelcome = () => {
    isWelcomeOpen.value = true
  }

  const acceptWelcome = async () => {
    isWelcomeOpen.value = false
    // Let the modal's leave transition finish before measuring anchors,
    // otherwise the spotlight is positioned against a shifting layout.
    await nextTick()
    setTimeout(startTour, 220)
  }

  const dismissWelcome = () => {
    isWelcomeOpen.value = false
  }

  const stopTour = () => {
    driverObj?.destroy()
    driverObj = null
  }

  onScopeDispose(() => {
    driverObj?.destroy()
    driverObj = null
    finish(false)
  })

  return {
    isWelcomeOpen,
    isRunning,
    hasCompletedTour,
    openWelcome,
    acceptWelcome,
    dismissWelcome,
    startTour,
    stopTour,
  }
}
