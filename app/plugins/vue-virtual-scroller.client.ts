import { defineNuxtPlugin } from '#app';
import VueVirtualScroller from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueVirtualScroller);
});
