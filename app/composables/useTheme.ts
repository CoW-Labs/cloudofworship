import type { Slide, Scripture } from "~/types"

/**
 * Theme definitions for Bible slides
 * Each theme defines how the scripture content and label are styled/positioned
 */
export interface BibleTheme {
  id: string
  name: string
  description: string
  icon: string
  preview: string // CSS class for preview styling
  /**
   * Layout configuration for the theme
   */
  layout: {
    labelPosition: 'bottom' | 'top' | 'overlay' | 'left' | 'right'
    labelSize: 'normal' | 'large' | 'xlarge'
    labelBackground: boolean
    contentAlignment?: 'left' | 'center' | 'right'
    labelAlignment?: 'left' | 'center' | 'right'
  }
  /**
   * Custom CSS classes to apply
   */
  cssClasses: {
    container?: string
    content?: string
    label?: string
  }
}

/**
 * Available Bible slide themes
 */
export const bibleThemes: BibleTheme[] = [
  {
    id: 'default',
    name: 'Classic',
    description: 'Scripture on top, label at bottom',
    icon: 'i-bx-bible',
    preview: 'theme-preview-classic',
    layout: {
      labelPosition: 'bottom',
      labelSize: 'normal',
      labelBackground: false,
      contentAlignment: 'center',
      labelAlignment: 'center',
    },
    cssClasses: {
      container: 'bible-theme-classic',
      content: '',
      label: '',
    },
  },
  {
    id: 'label-top',
    name: 'Header Reference',
    description: 'Scripture label appears at the top',
    icon: 'i-bx-up-arrow-alt',
    preview: 'theme-preview-label-top',
    layout: {
      labelPosition: 'top',
      labelSize: 'normal',
      labelBackground: false,
      contentAlignment: 'center',
      labelAlignment: 'center',
    },
    cssClasses: {
      container: 'bible-theme-label-top',
      content: '',
      label: '',
    },
  },
  {
    id: 'label-large',
    name: 'Bold Reference',
    description: 'Scripture label is 2x larger',
    icon: 'i-bx-font-size',
    preview: 'theme-preview-label-large',
    layout: {
      labelPosition: 'bottom',
      labelSize: 'xlarge',
      labelBackground: false,
    },
    cssClasses: {
      container: 'bible-theme-label-large',
      content: '',
      label: 'text-[2vw]',
    },
  },
  {
    id: 'label-background',
    name: 'Boxed Reference',
    description: 'Scripture label has a background',
    icon: 'i-bx-box',
    preview: 'theme-preview-label-bg',
    layout: {
      labelPosition: 'bottom',
      labelSize: 'normal',
      labelBackground: true,
    },
    cssClasses: {
      container: 'bible-theme-label-bg',
      content: '',
      label: 'text-[2vw] bg-white/10 pt-[1.5vw] mt-[3.5vw] leading-[0px]',
    },
  },
  {
    id: 'overlay',
    name: 'Overlay',
    description: 'Label overlays the scripture at bottom',
    icon: 'i-bx-layer',
    preview: 'theme-preview-overlay',
    layout: {
      labelPosition: 'overlay',
      labelSize: 'normal',
      labelBackground: true,
    },
    cssClasses: {
      container: 'bible-theme-overlay',
      content: 'pb-[7.5vw]',
      label: 'bg-gradient-to-t from-black/80 to-transparent pb-[3vw] px-[2vw] absolute bottom-0 left-0 right-0',
    },
  },
  // {
  //   id: 'side-reference',
  //   name: 'Side Reference',
  //   description: 'Label positioned on the right side',
  //   icon: 'i-bx-align-right',
  //   preview: 'theme-preview-side',
  //   layout: {
  //     labelPosition: 'right',
  //     labelSize: 'normal',
  //     labelBackground: true,
  //   },
  //   cssClasses: {
  //     container: 'bible-theme-side',
  //     content: 'text-left flex-1',
  //     label: 'bg-white/10 px-[1.5vw] py-[1vw] rounded-[0.5vw] writing-mode-vertical',
  //   },
  // },
]

/**
 * Get a theme by ID
 */
export const getThemeById = (themeId: string): BibleTheme => {
  return bibleThemes.find(theme => theme.id === themeId) || bibleThemes[0]
}

/**
 * Composable for managing slide themes
 */
export default function useTheme() {
  /**
   * Get the current theme for a slide
   */
  const getSlideTheme = (slide: Slide): BibleTheme => {
    const themeId = slide.slideStyle?.theme || 'default'
    return getThemeById(themeId)
  }

  /**
   * Apply theme styles to slide content
   * This transforms the content array based on the theme configuration
   */
  const applyThemeToContent = (
    slide: Slide,
    theme: BibleTheme
  ): {
    contents: string[],
    containerClass: string,
    isFlexRow: boolean
  } => {
    const contents = [...(slide.contents || [])]
    const containerClasses: string[] = [theme.cssClasses.container || '']

    // Apply label CSS classes
    if (theme.cssClasses.label && contents[1]) {
      // Parse and modify the label HTML to include theme classes
      contents[1] = contents[1].replace(
        /class="([^"]*)"/,
        `class="$1 ${theme.cssClasses.label}"`
      )
    }

    // Apply content CSS classes
    if (theme.cssClasses.content && contents[0]) {
      contents[0] = contents[0].replace(
        /class="([^"]*)"/,
        `class="$1 ${theme.cssClasses.content}"`
      )
    }

    // Reorder contents based on label position
    let reorderedContents = contents
    if (theme.layout.labelPosition === 'top') {
      // Swap label and content
      reorderedContents = [contents[1], contents[0]]
    }

    // Check if layout should be flex-row (for side-by-side themes)
    const isFlexRow = theme.layout.labelPosition === 'left' || theme.layout.labelPosition === 'right'

    // For right position, keep original order but add flex-row-reverse via container
    if (theme.layout.labelPosition === 'right') {
      containerClasses.push('flex-row-reverse')
      reorderedContents = contents
    }

    if (theme.layout.labelPosition === 'left') {
      reorderedContents = [contents[1], contents[0]]
    }

    return {
      contents: reorderedContents,
      containerClass: containerClasses.filter(Boolean).join(' '),
      isFlexRow,
    }
  }

  /**
   * Get CSS classes for the theme's label size
   */
  const getLabelSizeClass = (theme: BibleTheme): string => {
    switch (theme.layout.labelSize) {
      case 'large':
        return 'text-[150%]'
      case 'xlarge':
        return 'text-[200%]'
      default:
        return ''
    }
  }

  return {
    bibleThemes,
    getSlideTheme,
    getThemeById,
    applyThemeToContent,
    getLabelSizeClass,
  }
}
