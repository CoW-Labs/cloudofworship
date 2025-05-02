 <template>
  <div>
    <UButton
      v-if="noTooltip"
      :icon="buttonIcon"
      :button-size="buttonSize || 'xs'"
      :color="buttonColor"
      :variant="buttonVariant || 'ghost'"
      :class="buttonStyles"
      block
      @click.stop.prevent="isOpen = true"
      >{{ buttonLabel }}
    </UButton>
    <UTooltip v-else :text="header" :popper="{ placement: 'top' }">
      <UButton
        :icon="buttonIcon"
        :button-size="buttonSize || 'xs'"
        :color="buttonColor"
        :variant="buttonVariant || 'ghost'"
        :class="buttonStyles"
        @click.stop.prevent="isOpen = true"
        >{{ buttonLabel }}
      </UButton>
    </UTooltip>

    <UModal
      v-model="isOpen"
      :ui="{
        width: 'w-full sm:max-w-sm',
      }"
    >
      <div class="p-6">
        <Placeholder>
          <div class="flex flex-col justify-center h-full">
            <h4 class="text-md font-medium">{{ header }}</h4>
            <p class="mt-2 text-xs">{{ label }}</p>
            <div class="flex items-center justify-end gap-2 mt-6">
              <UButton variant="outline" color="gray" @click="handleCancel"
                >Cancel</UButton
              >
              <UButton
                :color="
                  header?.split(' ')[0] === 'Delete' ||
                  header?.split(' ')[0] === 'Sign'
                    ? 'red'
                    : 'primary'
                "
                @click="handleYesAction"
                >{{
                  header !== "Sign out" ? header?.split(" ")[0] : header
                }}</UButton
              >
            </div>
          </div>
        </Placeholder>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ButtonVariant } from '@nuxt/ui/dist/runtime/types';

const isOpen = ref(false)
const props = defineProps<{
  header: string
  label: string
  buttonIcon: string
  buttonStyles: string
  buttonColor: string
  buttonLabel?: string
  buttonSize?: string
  buttonVariant?: ButtonVariant
  noTooltip?: boolean
}>()
const emit = defineEmits(["confirm"])

const handleYesAction = () => {
  emit("confirm")
  isOpen.value = false
}

const handleCancel = () => {
  isOpen.value = false
}
</script>
