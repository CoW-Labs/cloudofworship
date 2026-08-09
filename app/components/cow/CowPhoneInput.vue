<template>
  <div class="cow-phone">
    <div
      class="cow-phone__field"
      :class="[
        { 'cow-phone__field--error': !!error },
        { 'cow-phone__field--floated': floated },
        { 'cow-phone__field--focused': focused },
      ]"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <label
        class="cow-phone__label"
        :class="{ 'cow-phone__label--float': floated }"
      >
        {{ label }}
      </label>

      <div class="cow-phone__row">
        <USelectMenu
          v-model="country"
          :options="countries"
          searchable
          :search-attributes="['name', 'dial']"
          variant="none"
          size="lg"
          class="cow-phone__country"
          :ui="countryUi"
          :ui-menu="countryMenuUi"
        >
          <template #label>
            <span class="cow-phone__flag">{{ flagEmoji(country.iso) }}</span>
            <span class="cow-phone__dial">{{ country.dial }}</span>
          </template>
          <template #option="{ option }">
            <span class="cow-phone__flag">{{ flagEmoji(option.iso) }}</span>
            <span class="truncate">{{ option.name }}</span>
            <span class="ml-auto opacity-60">{{ option.dial }}</span>
          </template>
        </USelectMenu>

        <span class="cow-phone__divider" />

        <input
          ref="numberRef"
          v-model="nationalNumber"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          class="cow-phone__input"
          :placeholder="floated ? placeholder : ''"
          @input="onNumberInput"
        />
      </div>
    </div>

    <div v-if="error" class="cow-phone__error come-up-1">
      <span class="cow-phone__error-text">
        <InfoIcon class="w-4 h-4" />
        {{ error }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Country {
  name: string
  iso: string
  dial: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    error?: string
    defaultIso?: string
  }>(),
  {
    modelValue: "",
    label: "Your phone number",
    placeholder: "812 345 6789",
    defaultIso: "NG",
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const countries: Country[] = [
  { name: "Nigeria", iso: "NG", dial: "+234" },
  { name: "Ghana", iso: "GH", dial: "+233" },
  { name: "Kenya", iso: "KE", dial: "+254" },
  { name: "South Africa", iso: "ZA", dial: "+27" },
  { name: "United States", iso: "US", dial: "+1" },
  { name: "United Kingdom", iso: "GB", dial: "+44" },
  { name: "Canada", iso: "CA", dial: "+1" },
  { name: "Ireland", iso: "IE", dial: "+353" },
  { name: "Australia", iso: "AU", dial: "+61" },
  { name: "India", iso: "IN", dial: "+91" },
  { name: "Pakistan", iso: "PK", dial: "+92" },
  { name: "Philippines", iso: "PH", dial: "+63" },
  { name: "Germany", iso: "DE", dial: "+49" },
  { name: "France", iso: "FR", dial: "+33" },
  { name: "Netherlands", iso: "NL", dial: "+31" },
  { name: "Spain", iso: "ES", dial: "+34" },
  { name: "Italy", iso: "IT", dial: "+39" },
  { name: "Portugal", iso: "PT", dial: "+351" },
  { name: "Brazil", iso: "BR", dial: "+55" },
  { name: "Mexico", iso: "MX", dial: "+52" },
  { name: "Uganda", iso: "UG", dial: "+256" },
  { name: "Tanzania", iso: "TZ", dial: "+255" },
  { name: "Rwanda", iso: "RW", dial: "+250" },
  { name: "Cameroon", iso: "CM", dial: "+237" },
  { name: "Ivory Coast", iso: "CI", dial: "+225" },
  { name: "Zambia", iso: "ZM", dial: "+260" },
  { name: "Zimbabwe", iso: "ZW", dial: "+263" },
  { name: "Egypt", iso: "EG", dial: "+20" },
  { name: "United Arab Emirates", iso: "AE", dial: "+971" },
  { name: "Saudi Arabia", iso: "SA", dial: "+966" },
  { name: "Singapore", iso: "SG", dial: "+65" },
  { name: "Malaysia", iso: "MY", dial: "+60" },
  { name: "Indonesia", iso: "ID", dial: "+62" },
  { name: "New Zealand", iso: "NZ", dial: "+64" },
  { name: "Jamaica", iso: "JM", dial: "+1" },
  { name: "Trinidad & Tobago", iso: "TT", dial: "+1" },
]

const flagEmoji = (iso: string) =>
  iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))

const findDefault = () =>
  countries.find((c) => c.iso === props.defaultIso) || countries[0]!

const focused = ref(false)
const numberRef = ref<HTMLInputElement | null>(null)
const country = ref<Country>(findDefault())
const nationalNumber = ref("")

// The country dial code is always visible, so the field never reads as
// "empty" — keep the label notched at the top to avoid overlapping "+234".
const floated = computed(() => true)

const digitsOnly = (s: string) => s.replace(/[^\d]/g, "")

const emitValue = () => {
  const digits = digitsOnly(nationalNumber.value)
  emit("update:modelValue", digits ? `${country.value.dial}${digits}` : "")
}

const onNumberInput = () => emitValue()

watch(country, emitValue)

// Parse an incoming E.164 value into dial code + national number (best effort)
watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    const current = `${country.value.dial}${digitsOnly(nationalNumber.value)}`
    if (val === current) return
    const match = [...countries]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => val.startsWith(c.dial))
    if (match) {
      country.value = match
      nationalNumber.value = val.slice(match.dial.length)
    }
  },
  { immediate: true }
)

const countryUi = {
  base: "relative flex items-center gap-1.5 text-left",
  rounded: "rounded-none",
  ring: "ring-0",
  shadow: "",
  variant: { none: "bg-transparent dark:bg-transparent focus:ring-0" },
  padding: { lg: "px-0 py-0" },
}

const countryMenuUi = {
  width: "w-72",
  rounded: "rounded-xl",
  ring: "ring-1 ring-gray-200 dark:ring-gray-700/70",
  shadow: "shadow-lg",
  background: "bg-white dark:bg-[#131a27]",
  option: {
    base: "flex items-center gap-2.5",
    rounded: "rounded-lg",
    padding: "px-3 py-2.5",
    active: "bg-gray-100 dark:bg-gray-800/60",
  },
}
</script>

<style scoped>
.cow-phone__field {
  position: relative;
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.05rem 1rem 0.85rem;
  box-shadow: none;
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.cow-phone__field.cow-phone__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.14);
}

.cow-phone__field.cow-phone__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.cow-phone__field.cow-phone__field--error,
.cow-phone__field.cow-phone__field--error.cow-phone__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
  background-color: #fef2f2;
}

.cow-phone__field--error .cow-phone__label--float {
  background-color: #fef2f2;
}

.cow-phone__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cow-phone__flag {
  font-size: 1.1rem;
  line-height: 1;
}

.cow-phone__dial {
  font-size: 15px;
  color: #0f172a;
  font-weight: 500;
}

.cow-phone__divider {
  width: 1px;
  align-self: stretch;
  background-color: rgba(15, 23, 42, 0.14);
}

.cow-phone__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background-color: transparent;
  font-size: 15px;
  color: #0f172a;
}

.cow-phone__input::placeholder {
  color: #94a3b8;
}

.cow-phone__label {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.95rem;
  pointer-events: none;
  padding: 0 0.3rem;
  background-color: transparent;
  transition: all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
}

.cow-phone__label--float {
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #475569;
  background-color: #ffffff;
}

.cow-phone__field--error .cow-phone__label {
  color: #ef4444;
}

.cow-phone__error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.55rem;
  font-size: 0.8rem;
  color: #ef4444;
}

.cow-phone__error-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
</style>

<style>
html.dark .cow-phone__field {
  background-color: #131a27;
  box-shadow: none;
}

html.dark .cow-phone__field.cow-phone__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.22);
}

html.dark .cow-phone__field.cow-phone__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}

html.dark .cow-phone__field.cow-phone__field--error,
html.dark
  .cow-phone__field.cow-phone__field--error.cow-phone__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
  background-color: #2a1416;
}

html.dark .cow-phone__field--error .cow-phone__label--float {
  background-color: #2a1416;
}

html.dark .cow-phone__dial,
html.dark .cow-phone__input {
  color: #f8fafc;
}

html.dark .cow-phone__divider {
  background-color: rgba(148, 163, 184, 0.22);
}

html.dark .cow-phone__label {
  color: #94a3b8;
}

html.dark .cow-phone__label--float {
  color: #cbd5e1;
  background-color: #131a27;
}
</style>
