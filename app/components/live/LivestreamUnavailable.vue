<template>
  <div
    class="livestream-unavailable fixed inset-0 grid place-items-center bg-black text-white px-6"
  >
    <div class="flex flex-col items-center text-center max-w-[26rem]">
      <Logo class="w-[56px] mb-8 opacity-90" />

      <h1 class="text-2xl font-semibold mb-3">This livestream isn't active</h1>

      <p class="text-white/60 text-[15px] leading-relaxed">
        Live output to a shared link is part of the
        <span class="text-white/90 font-medium">Teams</span> plan, and this
        church isn't on it right now. Nothing is being sent to this screen.
      </p>

      <p class="text-white/40 text-sm mt-6">
        If you're running the service, ask whoever manages your church's Cloud
        of Worship account to check the plan.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Shown on /livestream/:schedule_id when the server refuses the socket because
 * the schedule's church is not on Teams.
 *
 * Deliberately not an upgrade wall. /mobile-upgrade opens the upgrade modal
 * because the person looking at it is signed in and can act on it; whoever is
 * looking at this is an unauthenticated volunteer on the media desk with no
 * account, no card, and no way to complete that flow. Naming the plan tells
 * them why the screen is black — telling them to buy it would be a dead end.
 *
 * Black rather than the app's surface colours: this renders on the same screen
 * the projection would have, and the rest of that route is already black.
 */
</script>
