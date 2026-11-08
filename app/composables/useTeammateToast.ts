import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { safePlayMedia } from "~/utils/browserSafety"

const CHIME_SRC = "/sounds/teammate-chime.mp3"
const CHIME_VOLUME = 0.6
// A teammate pasting a setlist fires several events in a row. One chime is news; five is noise.
const CHIME_COOLDOWN_MS = 1500

let chime: HTMLAudioElement | null = null
let lastChimeAt = 0

const playTeammateChime = () => {
  if (typeof Audio === "undefined") return
  const now = Date.now()
  if (now - lastChimeAt < CHIME_COOLDOWN_MS) return
  lastChimeAt = now

  if (!chime) {
    chime = new Audio(CHIME_SRC)
    chime.preload = "auto"
    chime.volume = CHIME_VOLUME
  }
  chime.currentTime = 0
  // Blocked autoplay (no click on the page yet) is expected and silent.
  void safePlayMedia(chime)
}

/**
 * Shows a toast for something done on another device, and chimes when the
 * person who did it is a teammate. Your own second device (say /mobile) still
 * gets the toast, but no chime.
 */
export const useTeammateToast = () => {
  const toast = useToast()
  const authStore = useAuthStore()
  const appStore = useAppStore()
  return (fromUserId: string | undefined, options: Parameters<typeof toast.add>[0]) => {
    const id = toast.add(options)
    const soundsOn = appStore.currentState.settings.notificationSounds !== false
    if (soundsOn && (!fromUserId || fromUserId !== authStore.user?._id)) playTeammateChime()
    return id
  }
}
