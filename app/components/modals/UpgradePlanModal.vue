<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[800px] w-full max-w-[900px]',
        overlay: {
          background: 'bg-gray-200/75 dark:bg-gray-800/75',
        },
        padding: 'p-0',
      }"
    >
      <div
        class="upgrade-modal grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-lg"
      >
        <!-- Left Side - Pricing -->
        <div class="bg-white dark:bg-gray-900 p-8 relative">
          <button
            class="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
            @click="visible = false"
          >
            <IconWrapper name="i-heroicons-x-mark-20-solid" class="w-5 h-5" />
          </button>

          <!-- Currency Switcher for Testing (Development Only) -->
          <!-- <div
            v-if="$config.public.NODE_ENV !== 'production'"
            class="absolute top-4 left-4 flex gap-1 text-xs z-10"
          >
            <button
              @click="switchCurrency('NGN')"
              class="px-2 py-1 rounded transition-colors"
              :class="
                selectedCurrency === 'NGN'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              "
            >
              NGN
            </button>
            <button
              @click="switchCurrency('USD')"
              class="px-2 py-1 rounded transition-colors"
              :class="
                selectedCurrency === 'USD'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              "
            >
              USD
            </button>
          </div> -->

          <h2 class="text-2xl font-bold mb-6">Do more for your ministry</h2>

          <!-- Yearly Plan -->
          <div
            class="border-2 rounded-xl p-4 mb-4 cursor-pointer transition-all"
            :class="
              selectedPlan === 'yearly'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            "
            @click="selectedPlan = 'yearly'"
          >
            <div class="flex items-start justify-between mb-2">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-lg">Yearly</h3>
                  <UBadge color="green" variant="solid" size="xs">
                    Save 16%
                  </UBadge>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ currencySymbol }}{{ yearlyPrice.toLocaleString() }} / year
                </p>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="
                  selectedPlan === 'yearly'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                "
              >
                <div
                  v-if="selectedPlan === 'yearly'"
                  class="w-2 h-2 bg-white rounded-full"
                ></div>
              </div>
            </div>
          </div>

          <!-- Monthly Plan -->
          <div
            class="border-2 rounded-xl p-4 mb-6 cursor-pointer transition-all"
            :class="
              selectedPlan === 'monthly'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            "
            @click="selectedPlan = 'monthly'"
          >
            <div class="flex items-start justify-between mb-2">
              <div>
                <h3 class="font-semibold text-lg">Monthly</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ currencySymbol }}{{ monthlyPrice.toLocaleString() }} /
                  month
                </p>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="
                  selectedPlan === 'monthly'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                "
              >
                <div
                  v-if="selectedPlan === 'monthly'"
                  class="w-2 h-2 bg-white rounded-full"
                ></div>
              </div>
            </div>
          </div>

          <!-- Features List -->
          <div class="mb-6">
            <h4 class="font-semibold mb-3">
              Everything you need to elevate your worship experience
            </h4>
            <div class="space-y-2">
              <div
                v-for="feature in features"
                :key="feature"
                class="flex items-center gap-2 text-sm"
              >
                <IconWrapper
                  name="i-heroicons-check-circle-20-solid"
                  class="w-5 h-5 text-primary-500 flex-shrink-0"
                />
                <span>{{ feature }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <IconWrapper
                  name="i-heroicons-check-circle-20-solid"
                  class="w-5 h-5 text-primary-500 flex-shrink-0"
                />
                <span>
                  <a
                    href="https://cloudofworship.com/pricing"
                    class="text-primary-500 hover:underline"
                  >
                    See more benefits for your church.
                  </a>
                </span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2">
            <UButton
              color="primary"
              size="lg"
              block
              @click="handleUpgrade"
              :loading="loading"
              class="font-semibold"
            >
              Continue with
              {{ selectedPlan === "yearly" ? "Yearly" : "Monthly" }}
            </UButton>
            <UButton
              color="white"
              variant="ghost"
              size="lg"
              block
              @click="visible = false"
            >
              Maybe later
            </UButton>
          </div>

          <!-- Ends of Earth Initiative Disclaimer -->
          <div
            class="mb-6 mt-4 p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg"
          >
            <div class="flex gap-3">
              <IconWrapper
                name="i-heroicons-heart-solid"
                class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5"
              />
              <div class="text-sm">
                <p
                  class="font-semibold text-primary-700 dark:text-primary-400 mb-1 text-xs"
                >
                  Ends of Earth Initiative
                </p>
                <p class="text-gray-700 dark:text-gray-300 text-xs">
                  90% of profits go directly to efforts pushing the gospel
                  forward in churches across Africa and other regions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Testimonial Slideshow -->
        <div
          class="hidden md:block bg-cover bg-center relative overflow-hidden"
        >
          <div
            class="absolute inset-0"
            :style="`background-image: url('https://images.unsplash.com/photo-1532140225690-f6d25ab4c891?q=80&w=1740'); background-size: cover; background-position: center;`"
          ></div>
          <div class="absolute inset-0 bg-primary/40"></div>
          <div class="absolute inset-0 flex items-start pt-6 p-8">
            <div ref="reviewContainer" class="relative w-full">
              <div
                v-for="(review, index) in shuffledReviews"
                :key="index"
                ref="reviewSlides"
                class="review-slide text-white"
                :class="{
                  'absolute inset-0 opacity-0 pointer-events-none':
                    index !== currentReviewIndex,
                }"
              >
                <p class="text-xl mb-4 leading-relaxed">"{{ review.text }}"</p>
                <div class="flex items-center gap-3 mt-8">
                  <div
                    v-if="review.avatar"
                    class="w-10 min-w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold"
                    :style="`background-image: url('${review.avatar}'); background-size: cover; background-position: center;`"
                  ></div>
                  <div
                    v-else
                    class="w-10 min-w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm"
                  >
                    {{ review.name.charAt(0) }}
                  </div>
                  <div>
                    <p class="font-semibold text-sm">{{ review.name }}</p>
                    <p v-if="review.tagline" class="text-xs opacity-80">
                      {{ review.tagline }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UModal>

    <!-- Payment Success Modal -->
    <PaymentSuccessModal
      v-model="showSuccessModal"
      :plan-name="successPlanName"
      @close="handleSuccessModalClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { PaymentPlan } from "~/composables/usePayment";
import { gsap } from "gsap";

// Reviews extracted from user testimonials
const reviews = [
  {
    text: "I would definitely recommend CoW anytime! I am able to access my slides from any device, less stress with lyrics and scriptures, and there's the fast support team too. Peak love!",
    name: "Anonymous",
    avatar: "",
    tagline: "",
  },
  {
    text: "Cloud of Worship has been a game-changer for our church services. The intuitive interface makes it easy for our team to manage song lyrics, scriptures, and multimedia content seamlessly. Highly recommended for any church seeking a modern, efficient, and user-friendly presentation solution.",
    name: "Emmanuel Sebastian",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/avatar/14e49738-03e7-4855-9871-77e84f868b0b_1000384827.jpg",
    tagline: "Media Handler, MFMCF Unijos",
  },
  {
    text: "Cloud of Worship is, without a doubt, one of the best presentation software tools I've used in years. The design is user-friendly and intuitive, making it enjoyable to use, even for those who aren't tech-savvy. It's absolutely a game-changer.",
    name: "Darlington Letala",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/avatar/1744529c-fde0-410e-953d-2df9954851e1_1614239889013.jpg",
    tagline: "Church in Zimbabwe",
  },
  {
    text: "Love Cloud of Worship! Great interface, amazing tool for spreading the Gospel. Can't wait to see more exciting features!",
    name: "Adeshina Grace",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/avatar/7b0fae18-1467-4281-a2f2-d2af4b5f0d80_IMG_3863.jpeg",
    tagline: "Media, Fountain of Mercy Christian Church",
  },
  {
    text: "When I suddenly realised a significant improvement in the screen display, such that worship lyrics, Bible references and slides now come up speedily without delay, I knew something different had been added. I strongly recommend it for churches in need of an easy to use, yet efficient and reliable church presentation software.",
    name: "Engr Adebayo Awoyele",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/media/86f4d51b-de77-4860-b579-d31e86b76dc2_4025598a-64f3-484c-9528-c099131a38ff_bayo.jpg",
    tagline: "Congregant, FGC Ifako (Salvation Chapel)",
  },
  {
    text: "The app's ability for different users to create accounts and share lyrics fosters community. Cloud of Worship is indispensable, and we highly recommend it for any congregation looking to enhance their worship experience.",
    name: "Yinka Adenikinju",
    avatar: "/images/testimonials/bro-yinka.jpg",
    tagline: "Head of Media Ministry, Foursquare Gospel Church",
  },
  {
    text: "It is my pleasure to vet Cloud of Worship to be an excellent user centered application. Its user interface is very intuitive. The fact that it can virtually do what other projecting software does is amazing to me.",
    name: "Oluwasegun Akindele",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/avatar/7ad11edd-5712-4470-89b0-9b061cf04cf0_passport.png",
    tagline: "IT Support Specialist",
  },
  {
    text: "As a media personnel, finding the right projection software has always been challenging. However, Cloud of Worship has revolutionized our work. The user interface is incredibly intuitive, allowing our team to learn and operate it with ease quickly.",
    name: "Moshood Olawale Mustapha",
    avatar:
      "https://senja-io.s3.us-west-1.amazonaws.com/public/media/f8ce11c2-a830-421d-8af7-d1d09bf9b187_df19ae10-92da-41ce-8eec-387ba2364b72_moshood.jpg",
    tagline: "Live Streaming Lead, RCF Unilag",
  },
];

// Review slideshow state
const currentReviewIndex = ref(0);
const reviewContainer = ref<HTMLElement | null>(null);
const reviewSlides = ref<HTMLElement[]>([]);
let reviewInterval: ReturnType<typeof setInterval> | null = null;

const visible = ref(false);
const selectedPlan = ref<PaymentPlan>("yearly");

// Randomized reviews - shuffled each time modal opens
const shuffledReviews = ref([...reviews]);

// Fisher-Yates shuffle algorithm
const shuffleReviews = () => {
  const array = [...reviews];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  shuffledReviews.value = array;
};

const animateToNextReview = () => {
  if (!reviewSlides.value || reviewSlides.value.length === 0) return;

  const currentSlide = reviewSlides.value[currentReviewIndex.value];
  const nextIndex =
    (currentReviewIndex.value + 1) % shuffledReviews.value.length;
  const nextSlide = reviewSlides.value[nextIndex];

  if (!currentSlide || !nextSlide) return;

  // Animate current slide out
  gsap.to(currentSlide, {
    opacity: 0,
    y: -12,
    duration: 0.5,
    ease: "power2.inOut",
    onComplete: () => {
      currentSlide.classList.add("absolute", "inset-0", "pointer-events-none");
      currentSlide.style.opacity = "0";

      // Update index
      currentReviewIndex.value = nextIndex;

      // Prepare next slide
      nextSlide.classList.remove("absolute", "inset-0", "pointer-events-none");

      // Animate next slide in
      gsap.fromTo(
        nextSlide,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.inOut",
        },
      );
    },
  });
};

const startReviewSlideshow = () => {
  stopReviewSlideshow();
  reviewInterval = setInterval(animateToNextReview, 6000);
};

const stopReviewSlideshow = () => {
  if (reviewInterval) {
    clearInterval(reviewInterval);
    reviewInterval = null;
  }
};

// Watch modal visibility to start/stop slideshow
watch(visible, isVisible => {
  if (isVisible) {
    // Shuffle reviews when modal opens
    shuffleReviews();

    // Reset to first review when modal opens
    currentReviewIndex.value = 0;
    nextTick(() => {
      // Reset all slides
      reviewSlides.value?.forEach((slide, i) => {
        if (i === 0) {
          slide.classList.remove("absolute", "inset-0", "pointer-events-none");
          gsap.set(slide, { opacity: 1, y: 0 });
        } else {
          slide.classList.add("absolute", "inset-0", "pointer-events-none");
          gsap.set(slide, { opacity: 0, y: 0 });
        }
      });
      startReviewSlideshow();
    });
  } else {
    stopReviewSlideshow();
  }
});

// Use payment composable
const {
  loading,
  showSuccessModal,
  successPlanName,
  plansData,
  plansLoading,
  fetchPlans: fetchPaymentPlans,
  initiatePayment,
  loadPaystackScript,
} = usePayment();

// Use subscription plans composable
const {
  plans,
  selectedCurrency,
  detectedCurrency,
  isDetectingCurrency,
  detectCurrency,
  fetchPlans,
  getPlanByIntervalAndCurrency,
  getCurrencySymbol,
  formatAmount,
  setTestCurrency,
  getTestCurrency,
} = useSubscriptionPlans();

// Helper for testing: Allow manual currency switch
const switchCurrency = (currency: "NGN" | "USD") => {
  setTestCurrency(currency);
  selectedCurrency.value = currency;
  detectedCurrency.value = currency;
};

// Get pricing from API
const yearlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("yearly", selectedCurrency.value);
  if (!plan) return 0;

  // For USD, use amountCents if available
  if (plan.currency === "USD" && plan.amountCents) {
    return plan.amountCents / 100; // Convert cents to dollars
  }

  return plan.amount;
});

const monthlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("monthly", selectedCurrency.value);
  if (!plan) return 0;

  // For USD, use amountCents if available
  if (plan.currency === "USD" && plan.amountCents) {
    return plan.amountCents / 100; // Convert cents to dollars
  }

  return plan.amount;
});

const currencySymbol = computed(() => {
  return getCurrencySymbol(selectedCurrency.value);
});

const features = computed(() => {
  const plan = getPlanByIntervalAndCurrency(
    selectedPlan.value,
    selectedCurrency.value,
  );

  if (plan?.features && plan.features.length > 0) {
    return plan.features.slice(1, 6);
  }

  // Fallback features if API doesn't provide them
  return [
    "Access 9,000+ growing songs library",
    "Create custom text slides",
    "YouTube & Vimeo video support",
    "Dynamic countdown timers",
    "5GB cloud storage",
  ];
});

const emitter = useNuxtApp().$emitter as any;

onMounted(async () => {
  // Detect user's currency based on location
  await detectCurrency();

  // Fetch all subscription plans from API (both NGN and USD)
  await fetchPlans();

  // For local testing: Override currency detection by setting in console
  // localStorage.setItem('test_currency', 'USD') or localStorage.setItem('test_currency', 'NGN')
  // Then refresh the page

  emitter.on(
    "show-upgrade-modal",
    (data?: { planCode?: string; planId?: string }) => {
      visible.value = true;

      // Set plan based on plan_id (preferred) or plan_code (legacy support)
      if (data?.planId) {
        // Use plan_id to find the plan
        const plan = plans.value.find(p => p.id === data.planId);
        if (plan) {
          selectedPlan.value = plan.interval;
          // Override auto-detected currency with plan's currency if specified
          selectedCurrency.value = plan.currency;

          usePosthogCapture("UPGRADE_MODAL_OPENED", {
            planId: data.planId,
            interval: plan.interval,
            currency: plan.currency,
            autoDetectedCurrency: detectedCurrency.value,
            source: "signup",
          });
        }
      } else if (data?.planCode) {
        const plan = plans.value.find(p => p.planCode === data.planCode);
        if (plan) {
          selectedPlan.value = plan.interval;
          selectedCurrency.value = plan.currency;

          usePosthogCapture("UPGRADE_MODAL_OPENED", {
            planCode: data.planCode,
            planId: plan.id,
            interval: plan.interval,
            currency: plan.currency,
            autoDetectedCurrency: detectedCurrency.value,
            source: "signup",
          });
        }
      } else {
        // No specific plan provided, use auto-detected currency
        usePosthogCapture("UPGRADE_MODAL_OPENED", {
          source: "feature_gate",
          currency: selectedCurrency.value,
          autoDetectedCurrency: detectedCurrency.value,
        });
      }
    },
  );

  // Preload Paystack script
  loadPaystackScript().catch(console.error);
});

onBeforeUnmount(() => {
  emitter.off("show-upgrade-modal");
  stopReviewSlideshow();
});

const handleUpgrade = async () => {
  // Get the selected plan details
  const planDetails = getPlanByIntervalAndCurrency(
    selectedPlan.value,
    selectedCurrency.value,
  );

  if (!planDetails) {
    useToast().add({
      icon: "i-heroicons-exclamation-triangle",
      title: "Plan Not Found",
      description: "The selected plan is not available. Please try again.",
      color: "red",
    });
    return;
  }

  // Get the actual amount to charge (using amountCents for USD)
  const amount =
    selectedCurrency.value === "USD" && planDetails.amountCents
      ? planDetails?.amountCents || 0
      : planDetails?.amountKobo || 0;

  // Track upgrade attempt with currency
  usePosthogCapture("UPGRADE_INITIATED", {
    plan: selectedPlan.value,
    currency: selectedCurrency.value,
    autoDetectedCurrency: detectedCurrency.value,
    amount: amount,
    planId: planDetails?.id,
  });

  await initiatePayment({
    plan: selectedPlan.value,
    currency: selectedCurrency.value,
    onSuccess: async reference => {
      visible.value = false;
      useChurch().fetchChurch();
    },
    onCancel: () => {
      useToast().add({
        icon: "i-heroicons-x-circle",
        title: "Payment Cancelled",
        color: "orange",
      });
    },
    onError: error => {
      console.error("Payment error:", error);
    },
  });
};

const handleSuccessModalClose = () => {
  // Optionally refresh user data or redirect
  // The modal state is already managed by the composable
};
</script>

<style scoped>
.upgrade-modal {
  max-height: 90vh;
  /* overflow: hidden; */
}

.review-slide {
  will-change: opacity, transform;
}

.overlay {
  position: absolute;
  background: url("/images/slide-bg.jpeg") center/cover no-repeat;
  inset: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: lighten;
  opacity: 0.5;
  animation: rotateScale 90s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
  transform-origin: center center;
  transform: scale(1.15);
}

@keyframes rotateScale {
  0% {
    transform: rotate(0deg) scale(1.15);
  }
  50% {
    transform: rotate(5deg) scale(1.6);
  }
  70% {
    transform: rotate(-5deg) scale(1.35);
  }
  100% {
    transform: rotate(-5deg) scale(1.15);
  }
}
</style>
