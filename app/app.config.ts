export default defineAppConfig({
  ui: {
    primary: 'purple',
    icons: ['mdi', 'bx', 'bxs', 'bi', 'mingcute', 'tabler', 'ph', 'lucide'],
    tooltip: {
      rounded: 'rounded-md',
      background: 'bg-slate-100 dark:bg-slate-900',
      color: 'text-black dark:text-white',
      ring: 'ring-none ring-0 ring-transparent',
      shadow: 'none',
      // arrow: {
      //   ring: 'ring-gray-800',
      //   background: 'bg-red-500'
      // }
    },
    input: {
      wrapper: 'shadow-none',
      rounded: 'rounded-md',
      color: 'red',
      base: 'bg-gray-100 dark:bg-primary-900 dark:text-primary-900',
      variant: {
        outline: 'shadow-none text-gray-900 dark:text-primary-900 ring-1 ring-inset ring-{color}-500 dark:ring-{color}-400 focus:ring-2 focus:ring-{color}-500 dark:focus:ring-{color}-400',
        none: 'shadow-none bg-gray-100 dark:bg-light-200 focus:ring-0 focus:shadow-none dark:text-primary-900',
      },
      default: {
        variant: 'none'
      }
    },
    button: {
      default: {
        loadingIcon: 'i-bx-loader-alt'
      }
    },
    textarea: {
      color: {
        gray: {
          none: ' bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white ring-0 focus:ring-0',
        },
      }
    },
    notifications: {
      position: 'top-6 right-2 bottom-auto',
    }
  }
})