<template #default="{ defaultProps }">
  <div
    class="flex h-full min-h-0 px-4 pb-2 pt-2 short:px-3 short:pb-1 short:pt-1"
  >
    <div
      :style="{ width: quickActionsWidth + 'px', flexShrink: 0 }"
      class="h-full"
    >
      <QuickActions />
    </div>
    <div
      class="w-2 flex-shrink-0 mx-1 cursor-ew-resize rounded opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startResize('left', $event)"
    />
    <PreviewContent class="flex-1 min-w-0 h-full" />
    <div
      class="w-2 flex-shrink-0 mx-1 cursor-ew-resize rounded opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startResize('right', $event)"
    />
    <div
      :style="{ width: liveOutputWidth + 'px', flexShrink: 0 }"
      class="h-full"
    >
      <LiveOutput />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "app",
})
useHead({
  link: [
    {
      rel: "manifest",
      href: "/manifest.json",
    },
  ],
})
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { until } from "@vueuse/core"
import { computed, ref } from "vue"

const appStore = useAppStore()

// Resizable panel widths — bounds and defaults track the viewport so the three
// columns keep their proportions on smaller screens instead of squeezing the
// centre column down to two thumbnails per row.
const { panelBounds, panelSize, commitPanelSize } = usePanelLayout()
const quickActionsBounds = panelBounds("quickActionsWidth")
const liveOutputBounds = panelBounds("liveOutputWidth")
const quickActionsLayoutWidth = panelSize("quickActionsWidth")
const liveOutputLayoutWidth = panelSize("liveOutputWidth")

const quickActionsWidth = ref(quickActionsLayoutWidth.value)
const liveOutputWidth = ref(liveOutputLayoutWidth.value)

let resizingPanel: "left" | "right" | null = null

// Follow the viewport on resize, but never fight the user mid-drag.
watch(quickActionsLayoutWidth, (width) => {
  if (!resizingPanel) quickActionsWidth.value = width
})
watch(liveOutputLayoutWidth, (width) => {
  if (!resizingPanel) liveOutputWidth.value = width
})
let resizeStartX = 0
let resizeStartWidth = 0

const startResize = (panel: "left" | "right", event: MouseEvent) => {
  resizingPanel = panel
  resizeStartX = event.clientX
  resizeStartWidth =
    panel === "left" ? quickActionsWidth.value : liveOutputWidth.value
  document.addEventListener("mousemove", onResizeMove)
  document.addEventListener("mouseup", onResizeEnd)
  document.body.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"
}

const onResizeMove = (event: MouseEvent) => {
  if (!resizingPanel) return
  const delta = event.clientX - resizeStartX
  if (resizingPanel === "left") {
    const { min, max } = quickActionsBounds.value
    quickActionsWidth.value = Math.min(
      max,
      Math.max(min, resizeStartWidth + delta)
    )
  } else {
    const { min, max } = liveOutputBounds.value
    liveOutputWidth.value = Math.min(
      max,
      Math.max(min, resizeStartWidth - delta)
    )
  }
}

const onResizeEnd = () => {
  if (resizingPanel === "left") {
    commitPanelSize("quickActionsWidth", quickActionsWidth.value)
  } else if (resizingPanel === "right") {
    commitPanelSize("liveOutputWidth", liveOutputWidth.value)
  }
  resizingPanel = null
  document.removeEventListener("mousemove", onResizeMove)
  document.removeEventListener("mouseup", onResizeEnd)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

// Realtime session — the socket connection, incoming slide events, presence
// and the livestream broadcast. Shared verbatim with the mobile operator route.
useOperatorSession()

/**
 * Open the plan chooser for a `/?upgrade=1` / `/?plan_id=<id>` link.
 *
 * `getCurrentPlan` fails safe to "free" until the church lands, so firing on
 * mount would hand a Teams church a bill for what it already pays for. Wait
 * for the plan to be knowable first, and give up on the wait after a moment so
 * a slow (or failed) church fetch doesn't swallow the link entirely.
 */
const openUpgradeFromDeeplink = async (planId?: string) => {
  const authStore = useAuthStore()
  const { isTeamsPlan } = useSubscription()
  const isPlanKnown = computed(
    () => !!authStore.church && authStore.church._id === authStore.user?.churchId
  )

  await Promise.all([
    // UpgradePlanModal only registers its emitter listener after it has
    // fetched plans and detected currency, so an emit fired the instant the
    // church hydrates from persisted state would land on nobody. The same
    // one-second floor the signup hand-off below relies on.
    new Promise((resolve) => setTimeout(resolve, 1000)),
    Promise.race([
      until(isPlanKnown).toBe(true),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]),
  ])

  if (isPlanKnown.value && isTeamsPlan.value) return

  usePosthogCapture("UPGRADE_MODAL_OPENED_FROM_DEEPLINK", {
    planId,
    hasPlanId: !!planId,
  })

  useGlobalEmit(
    appWideActions.showUpgradeModal,
    planId ? { planId } : undefined
  )
}

onMounted(async () => {
  const emailChange = useRoute().query.email_change

  // console.log("emailChange", emailChange)
  if (emailChange) {
    setTimeout(() => {
      useGlobalEmit(appWideActions.openSettings, "Profile Settings")
    }, 1000)
  }

  // Fresh signups land here (directly, or via /verify) with `newUser=1` still
  // on the URL. The welcome card doesn't open yet — useOnboardingTour holds it
  // until the operator's active schedule actually has a slide on it, so the
  // walkthrough isn't pointed at an empty/hidden workspace.
  if (useRoute().query.newUser) {
    markOnboardingTourPending()
  }

  // Deeplink — `/?upgrade=1` opens the plan chooser, and `/?plan_id=<id>` does
  // the same with that plan preselected. These are for links we send out (win-
  // back mail, expiry notices), so unlike the signup hand-off below they work
  // for any signed-in user, not only a fresh account.
  const route = useRoute()
  const router = useRouter()
  const deeplinkPlanId = (route.query.plan_id as string) || undefined
  const upgradeDeeplinked = !!route.query.upgrade || !!deeplinkPlanId

  if (upgradeDeeplinked) {
    // Consume the params immediately so a reload — or the operator leaving this
    // tab open all service — doesn't put the modal back up.
    const { upgrade: _upgrade, plan_id: _planId, ...restQuery } = route.query
    router.replace({ query: restQuery })

    openUpgradeFromDeeplink(deeplinkPlanId)
  }

  // Check for pending plan_id from signup flow
  try {
    const pendingPlanId = localStorage.getItem("pending_plan_id")
    if (pendingPlanId) {
      localStorage.removeItem("pending_plan_id")

      // The deeplink already opened the modal (and with a plan id of its own,
      // which is the more deliberate of the two). Just clear the stashed key.
      if (!upgradeDeeplinked) {
        usePosthogCapture("UPGRADE_MODAL_OPENED_AFTER_VERIFICATION", {
          planId: pendingPlanId,
        })

        // Show upgrade modal after a brief delay
        setTimeout(() => {
          useGlobalEmit("show-upgrade-modal", { planId: pendingPlanId })
        }, 1000)
      }
    }
  } catch {
    // localStorage unavailable (private mode / SecurityError)
  }

  // APP-WIDE SHORTCUTS — every combo comes from the registry in
  // ~/utils/shortcuts, so the keys bound here and the keycaps rendered in
  // tooltips and the shortcuts modal can never drift apart.
  useRegisteredShortcut(shortcutIds.quickActionsSlash, () =>
    useGlobalEmit(appWideActions.quickActionsFocus)
  )
  useRegisteredShortcut(shortcutIds.quickActions, () =>
    useGlobalEmit(appWideActions.quickActionsFocus)
  )

  // Prevent default action on specific keys
  document.addEventListener("keydown", function (event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "?"
    ) {
      event.preventDefault()
    }
  })

  useRegisteredShortcut(shortcutIds.promoteActiveSlide, () => {
    useGlobalEmit(appWideActions.promoteActiveSlide)
  })

  // "?" is the near-universal "show me the shortcuts" key (GitHub, Slack,
  // Linear, Gmail). Cmd+H stays as a Windows/Linux alias — macOS swallows it
  // for "Hide Application", so it never reaches the app on desktop.
  useRegisteredShortcut(shortcutIds.shortcutsModal, () => {
    useGlobalEmit(appWideActions.openShortcutsModal)
  })
  useRegisteredShortcut(shortcutIds.shortcutsModalAlt, () => {
    useGlobalEmit(appWideActions.openShortcutsModal)
  })

  useRegisteredShortcut(shortcutIds.openSchedules, () => {
    useGlobalEmit(appWideActions.openScheduleModal)
  })

  useRegisteredShortcut(shortcutIds.settings, () => {
    useGlobalEmit(appWideActions.openSettings)
  })
})

// Cleanup on unmount — the socket half is owned by useOperatorSession.
onBeforeUnmount(() => {
  appStore.setPanelSize("quickActionsWidth", quickActionsWidth.value)
  appStore.setPanelSize("liveOutputWidth", liveOutputWidth.value)
  document.removeEventListener("mousemove", onResizeMove)
  document.removeEventListener("mouseup", onResizeEnd)
})
</script>
