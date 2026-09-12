import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"

/**
 * Driving one device's live output from another — specifically, a phone on
 * /mobile driving the machine that actually has the projector attached.
 *
 * ── Why this is not the old "multiple presenters" feature ────────────────────
 *
 * An earlier version of this synced `live-slide` symmetrically: every client in
 * the schedule applied every other client's selection. It was pulled mid-2026
 * because it interfered with services — any window that happened to be open on
 * the schedule could move the congregation screen, and there was no way to say
 * *which* screen a change was meant for. It also guarded the resulting echo
 * with a one-tick global boolean, which swallowed the next genuine local
 * selection whenever the watcher it expected did not fire.
 *
 * Three rules keep that from happening again, and every one of them is
 * structural rather than a flag someone has to remember to set:
 *
 *  1. **A request names one output.** `targetHostId` is a specific device id.
 *     A session applies a request only when the id is its own, so a change can
 *     never spill onto a screen it was not addressed to.
 *  2. **Only a real output answers.** A session advertises itself only while it
 *     owns an open live window (see `setLocalOutputPresent`, fed by the app
 *     layout's `windowRefs`) and the operator has left mobile control enabled.
 *     A laptop merely viewing the schedule is not a host and ignores requests.
 *  3. **Control is one-way and has no echo to suppress.** Controllers send
 *     `live-control-request`; hosts send `live-control-host` announcements.
 *     Neither is ever re-sent in response to the other, so there is no loop and
 *     therefore no suppression flag. The host remains the only device that
 *     broadcasts `live-slide` to livestream viewers — a controller stands down
 *     from that job for as long as it is delegating (see `useOperatorSession`).
 *
 * The controller's own `liveSlideId` mirrors whatever the host last announced,
 * so the phone's preview and its red "live" marker show what the congregation
 * is actually looking at rather than what the phone asked for.
 */

/** Survives reloads, so a host keeps its identity when the operator refreshes. */
const DEVICE_ID_KEY = "cow-output-device-id"

/** Heartbeat cadence for host announcements. */
const ANNOUNCE_INTERVAL = 8000

/** A host unheard from for this long is treated as gone (three missed beats). */
const HOST_TIMEOUT = 25000

/** How long to wait for a host to confirm a request before warning about it. */
const ACK_TIMEOUT = 4000

/** A controller idle this long stops being shown on the host's header. */
const CONTROLLER_IDLE_TIMEOUT = 120000

export type LiveOutputHostAnnouncement = {
  hostId: string
  userId: string
  userName: string
  deviceLabel: string
  /** False while the host is shutting its output down or has opted out. */
  available: boolean
  liveSlideId: string | null
  ts: number
}

export type LiveOutputControlRequest = {
  targetHostId: string
  controllerId: string
  controllerName: string
  action: "go-live" | "blank"
  slideId: string | null
  ts: number
}

type KnownHost = LiveOutputHostAnnouncement & { seenAt: number }

type RemoteController = {
  id: string
  name: string
  at: number
}

let cachedDeviceId: string | null = null

/**
 * A stable id for this browser/desktop installation. Deliberately not
 * `tabSessionId`: that is regenerated on every page load, so a host would lose
 * its identity — and the phone pointed at it — on an operator refresh.
 */
export const liveOutputDeviceId = () => {
  if (cachedDeviceId) return cachedDeviceId
  if (typeof window === "undefined") return "server"

  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY)
    if (stored) {
      cachedDeviceId = stored
      return stored
    }
  } catch {
    // Private mode / storage disabled — fall through to a per-session id.
  }

  const generated =
    crypto.randomUUID?.() ||
    `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

  try {
    window.localStorage.setItem(DEVICE_ID_KEY, generated)
  } catch {
    // Not persisted; the id still holds for this session.
  }

  cachedDeviceId = generated
  return generated
}

// Timers and watcher handles live at module scope: `start()` is called once per
// operator page (from useOperatorSession) while the composable itself is called
// from every SlideCard, and none of those calls may register a heartbeat.
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let stopWatchers: Array<() => void> = []

/**
 * Ordering guard, kept per controller. A single shared high-water mark would
 * compare timestamps written by *different* wall clocks, so one phone running a
 * few minutes fast would silently lock every other device out for the rest of
 * the service. Within one controller the clock is its own, and monotonic.
 */
const lastAppliedRequestTs = new Map<string, number>()

/** Whether the operator has already been told their chosen host went quiet. */
let announcedHostLoss = false

/** The one in-flight request being watched for confirmation, if any. */
let ackTimer: ReturnType<typeof setTimeout> | null = null

export const useLiveOutputControl = () => {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()

  // Shared by every caller in this window.
  const hosts = useState<Record<string, KnownHost>>(
    "live-output-hosts",
    () => ({})
  )
  const targetHostId = useState<string | null>(
    "live-output-target-host",
    () => null
  )
  const hasLocalOutput = useState<boolean>(
    "live-output-window-present",
    () => false
  )
  const remoteController = useState<RemoteController | null>(
    "live-output-remote-controller",
    () => null
  )
  // Bumped by the heartbeat so the expiry computeds below re-evaluate without
  // every consumer running its own timer.
  const clock = useState<number>("live-output-clock", () => Date.now())

  const deviceId = liveOutputDeviceId()

  /**
   * This session owns a live output and will answer requests addressed to it.
   * Both halves matter: the window has to exist, and the operator sitting at
   * this machine has to have left mobile control switched on.
   */
  const isOutputHost = computed(
    () =>
      hasLocalOutput.value &&
      appStore.currentState.settings.allowRemoteControl !== false
  )

  const deviceLabel = computed(() => {
    if (typeof window === "undefined") return "Unknown device"
    const os = useClientOS()
    const { isTauri } = useTauri()
    return `${os} · ${isTauri ? "Desktop app" : "Browser"}`
  })

  /**
   * The screens on offer right now. This device is never among them: an
   * operator does not drive their own output by remote.
   */
  const availableHosts = computed(() =>
    Object.values(hosts.value)
      .filter(
        (host) =>
          host.available &&
          host.hostId !== deviceId &&
          clock.value - host.seenAt < HOST_TIMEOUT
      )
      .sort((a, b) => a.userName.localeCompare(b.userName))
  )

  const targetHost = computed(
    () =>
      availableHosts.value.find((host) => host.hostId === targetHostId.value) ||
      null
  )

  /** True while this session's go-live actions belong to another device. */
  const isControllingRemoteHost = computed(() => !!targetHost.value)

  /** The controller shown on a host's header, once it has gone quiet. */
  const activeRemoteController = computed(() =>
    remoteController.value &&
    clock.value - remoteController.value.at < CONTROLLER_IDLE_TIMEOUT
      ? remoteController.value
      : null
  )

  const socket = () => {
    try {
      return useNuxtApp().$socketio as any
    } catch {
      return null
    }
  }

  const findSlide = (slideId?: string | null) =>
    slideId
      ? appStore.activeSlides.find(
          (slide) => slide.id === slideId || slide._id === slideId
        )
      : undefined

  // ── Host side ──────────────────────────────────────────────────────────────

  /**
   * Advertise this device's output. `force` is for the two moments the news is
   * that there is *no* output any more — the setting being switched off, or the
   * live window closing — where the announcement has to go out even though this
   * device no longer qualifies as a host.
   */
  const announce = (options?: { force?: boolean }) => {
    const connection = socket()
    if (!connection?.connected) return
    // Every other device on the schedule is a peer, not a screen. Staying quiet
    // is what keeps a phone's list of outputs to the machines that really have
    // one, instead of every laptop with the schedule open.
    if (!isOutputHost.value && !options?.force) return

    const payload: LiveOutputHostAnnouncement = {
      hostId: deviceId,
      userId: authStore.user?._id || "",
      userName: authStore.user?.fullname || "Operator",
      deviceLabel: deviceLabel.value,
      available: isOutputHost.value,
      liveSlideId: appStore.currentState.liveSlideId || null,
      ts: Date.now(),
    }

    connection.emit("live-control-host", payload)
  }

  /**
   * Take a slide live on this device: the same two steps a click on the
   * schedule has always run, so a remote request and a local click cannot
   * diverge.
   */
  const applyLiveSlideLocally = (slide: Slide) => {
    useBroadcastPost(slide)
    appStore.setLiveSlide(slide.id)
  }

  const applyBlankLocally = () => {
    useBroadcastPost(null)
    appStore.setLiveSlide("")
  }

  const applyControlRequest = (request: LiveOutputControlRequest) => {
    // Rule 1: addressed to this device, and nowhere else.
    if (request.targetHostId !== deviceId) return
    // Rule 2: only a session that actually owns an output answers.
    if (!isOutputHost.value) return
    // A request that lost a race to a newer one from the same device never
    // lands — an out-of-order delivery must not walk the screen backwards.
    const controllerId = request.controllerId || "unknown"
    if (request.ts <= (lastAppliedRequestTs.get(controllerId) ?? 0)) return
    lastAppliedRequestTs.set(controllerId, request.ts)

    remoteController.value = {
      id: request.controllerId,
      name: request.controllerName,
      at: Date.now(),
    }

    if (request.action === "blank") {
      applyBlankLocally()
      return
    }

    // Project this device's own copy of the slide. Media keys resolve against
    // local storage, so the wire payload would not necessarily render here.
    const slide = findSlide(request.slideId)
    if (!slide || slide.slideMode === "overlay") return
    applyLiveSlideLocally(slide)
  }

  /**
   * Stop answering remote requests. Flips the persisted setting rather than a
   * session flag, so the operator can find the switch again in Settings →
   * Display instead of wondering why their phone stopped working next week.
   */
  const stopRemoteControl = () => {
    appStore.setAllowRemoteControl(false)
    remoteController.value = null
    announce({ force: true })
    toast.add({
      title: "Mobile control turned off",
      description: "Turn it back on in Settings → Display settings.",
      icon: "i-bx-mobile",
      color: "amber",
    })
  }

  // ── Controller side ────────────────────────────────────────────────────────

  const connectToHost = (hostId: string) => {
    const host = hosts.value[hostId]
    if (!host) return

    // A device with its own projector drives that, full stop. Controlling a
    // second output from it would put the same operator on two screens at once.
    if (hasLocalOutput.value) {
      toast.add({
        title: "This device already has a live output",
        description: "Close the live window here before controlling another screen.",
        icon: "i-bx-info-circle",
        color: "amber",
      })
      return
    }

    announcedHostLoss = false
    targetHostId.value = hostId
    // Show what that screen is on right now, not what this device last touched.
    appStore.setLiveSlide(host.liveSlideId || "")

    toast.add({
      title: `Controlling ${host.userName}'s output`,
      description: host.deviceLabel,
      icon: "i-bx-slideshow",
      color: "green",
      timeout: 3000,
    })
  }

  const stopControlling = (options?: { silent?: boolean }) => {
    if (!targetHostId.value) return
    targetHostId.value = null
    announcedHostLoss = false
    if (options?.silent) return

    toast.add({
      title: "Stopped controlling that output",
      description: "Slides you take live no longer reach that screen.",
      icon: "i-bx-info-circle",
      timeout: 3000,
    })
  }

  const sendControlRequest = (
    action: LiveOutputControlRequest["action"],
    slideId: string | null
  ) => {
    const host = targetHost.value
    if (!host) return false

    const connection = socket()
    if (!connection?.connected) {
      toast.add({
        title: "You're offline",
        description: "Reconnect to keep controlling the live output.",
        icon: "i-bx-wifi-off",
        color: "red",
      })
      return false
    }

    const request: LiveOutputControlRequest = {
      targetHostId: host.hostId,
      controllerId: deviceId,
      controllerName: authStore.user?.fullname || "A team member",
      action,
      slideId,
      ts: Date.now(),
    }

    connection.emit("live-control-request", request)
    watchForAck(host.hostId, action === "blank" ? "" : slideId || "")
    return true
  }

  /**
   * A host confirms by announcing its new `liveSlideId`. If the screen has not
   * moved by the time this fires, the operator is told rather than being left
   * with a phone that claims a slide is live when it is not.
   *
   * Only the most recent request is watched. Advancing three slides inside the
   * timeout used to leave two stale watchdogs armed, each of which would find
   * the screen on a *later* slide than it expected, cry failure, and drag the
   * phone back to a slide the operator had already moved past.
   */
  const watchForAck = (hostId: string, expectedSlideId: string) => {
    if (ackTimer) clearTimeout(ackTimer)

    ackTimer = setTimeout(() => {
      ackTimer = null
      if (targetHostId.value !== hostId) return

      // Read the wall clock rather than the heartbeat's `clock`, which can be
      // up to one beat stale and would call a dead host healthy.
      const host = hosts.value[hostId]
      if (!host || Date.now() - host.seenAt >= HOST_TIMEOUT) {
        toast.add({
          title: "Lost the live output device",
          description: "It stopped responding, so nothing was taken live there.",
          icon: "i-bx-error-circle",
          color: "red",
        })
        stopControlling({ silent: true })
        return
      }

      if ((host.liveSlideId || "") === expectedSlideId) return

      toast.add({
        title: `${host.userName}'s output didn't change`,
        description: "That slide may not have reached the output device yet.",
        icon: "i-bx-error-circle",
        color: "amber",
      })
      // Snap back to what that screen is really showing.
      appStore.setLiveSlide(host.liveSlideId || "")
    }, ACK_TIMEOUT)
  }

  // ── The one go-live path, local or remote ──────────────────────────────────

  /**
   * Take a slide live. On a device controlling another output this sends a
   * request there and mirrors the result locally; everywhere else it is the
   * plain local projection it has always been.
   */
  const goLive = (slideId: string) => {
    const slide = findSlide(slideId)
    if (!slide) return
    if (slide.slideMode === "overlay") return

    if (isControllingRemoteHost.value) {
      if (!sendControlRequest("go-live", slide.id)) return
      // Optimistic only — the host's next announcement confirms or corrects it.
      appStore.setLiveSlide(slide.id)
      return
    }

    applyLiveSlideLocally(slide)
  }

  /** Blank the output this device is responsible for. */
  const blankOutput = () => {
    if (isControllingRemoteHost.value) {
      if (!sendControlRequest("blank", null)) return
      appStore.setLiveSlide("")
      return
    }

    applyBlankLocally()
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  /** Called by useRealtimeSlides for the two control events. */
  const handleControlMessage = (action: string, data: any) => {
    if (!data) return

    if (action === "live-control-host") {
      const announcement = data as LiveOutputHostAnnouncement
      if (!announcement.hostId || announcement.hostId === deviceId) return

      const known = hosts.value[announcement.hostId]
      // Announcements are heartbeats, so an out-of-order one is stale by
      // definition and would otherwise resurrect a screen that has gone.
      if (known && announcement.ts < known.ts) return

      hosts.value = {
        ...hosts.value,
        [announcement.hostId]: { ...announcement, seenAt: Date.now() },
      }

      if (!announcement.available && targetHostId.value === announcement.hostId) {
        stopControlling({ silent: true })
        toast.add({
          title: `${announcement.userName}'s output is no longer available`,
          icon: "i-bx-info-circle",
          color: "amber",
        })
      }
      return
    }

    if (action === "live-control-request") {
      applyControlRequest(data as LiveOutputControlRequest)
    }
  }

  /**
   * Starts the heartbeat and the host/controller watchers. Called once, by
   * useOperatorSession, for the lifetime of an operator page.
   */
  const start = () => {
    if (heartbeatTimer) return

    heartbeatTimer = setInterval(() => {
      clock.value = Date.now()
      announce()
    }, ANNOUNCE_INTERVAL)

    // Announce the moment this device gains or loses its output, so a phone
    // does not wait out a heartbeat to see a screen appear or disappear.
    stopWatchers.push(
      watch(isOutputHost, () => {
        clock.value = Date.now()
        announce({ force: true })
      })
    )

    // A host confirms every change — its own clicks included — which is what
    // keeps a controlling phone showing the real state of the screen.
    stopWatchers.push(
      watch(
        () => appStore.currentState.liveSlideId,
        () => announce()
      )
    )

    // Mirror the host's output onto this device while controlling it.
    stopWatchers.push(
      watch(
        () => targetHost.value?.liveSlideId,
        (hostLiveSlideId) => {
          if (!isControllingRemoteHost.value) return
          const next = hostLiveSlideId || ""
          if ((appStore.currentState.liveSlideId || "") === next) return
          appStore.setLiveSlide(next)
        }
      )
    )

    // Opening a live window here means this device now has its own screen to
    // drive; it stops being a remote for someone else's.
    stopWatchers.push(
      watch(hasLocalOutput, (present) => {
        if (present && targetHostId.value) stopControlling()
      })
    )

    // A chosen host can drop out (its operator closed the live window, or the
    // laptop reloaded) and come back under the same device id. Control resumes
    // when it does — the operator picked that machine, and a reload should not
    // cost them their remote mid-service — but neither the loss nor the return
    // happens quietly, because "my taps stopped working" and "my taps started
    // working again" are both things they have to know without checking.
    stopWatchers.push(
      watch(isControllingRemoteHost, (controlling) => {
        if (!targetHostId.value) return

        if (!controlling) {
          announcedHostLoss = true
          toast.add({
            title: "Lost contact with that output",
            description: "Slides you take live are not reaching it right now.",
            icon: "i-bx-wifi-off",
            color: "amber",
          })
          return
        }

        if (announcedHostLoss) {
          announcedHostLoss = false
          toast.add({
            title: `Back in control of ${targetHost.value?.userName}'s screen`,
            icon: "i-bx-slideshow",
            color: "green",
            timeout: 3000,
          })
        }
      })
    )

    announce()
  }

  const stop = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (ackTimer) {
      clearTimeout(ackTimer)
      ackTimer = null
    }
    stopWatchers.splice(0).forEach((unwatch) => unwatch())

    // Tell controllers this screen is going away rather than leaving them to
    // time it out mid-service.
    if (isOutputHost.value) {
      const connection = socket()
      if (connection?.connected) {
        connection.emit("live-control-host", {
          hostId: deviceId,
          userId: authStore.user?._id || "",
          userName: authStore.user?.fullname || "Operator",
          deviceLabel: deviceLabel.value,
          available: false,
          liveSlideId: null,
          ts: Date.now(),
        } satisfies LiveOutputHostAnnouncement)
      }
    }

    hosts.value = {}
    targetHostId.value = null
    remoteController.value = null
    lastAppliedRequestTs.clear()
    announcedHostLoss = false
  }

  return {
    // Shared actions — the only two ways anything reaches a live output.
    goLive,
    blankOutput,

    // Controller
    availableHosts,
    targetHost,
    isControllingRemoteHost,
    connectToHost,
    stopControlling,

    // Host
    announce,
    isOutputHost,
    hasLocalOutput: readonly(hasLocalOutput),
    activeRemoteController,
    stopRemoteControl,

    // Plumbing
    handleControlMessage,
    start,
    stop,
  }
}

/**
 * Whether this device currently owns a live output window — the single fact
 * that decides whether this session may answer remote requests at all. Written
 * by the app layout from `windowRefs`; resolve it in a setup block and write to
 * the ref, rather than reaching for it from inside a watcher callback.
 */
export const useLocalOutputPresence = () =>
  useState<boolean>("live-output-window-present", () => false)
