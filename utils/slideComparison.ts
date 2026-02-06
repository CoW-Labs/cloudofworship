import type { Slide } from "~/types";

/**
 * Efficiently compares two slides to detect meaningful changes
 * Uses shallow comparison of key properties instead of expensive JSON.stringify
 * @param newSlide - The new slide to compare
 * @param oldSlide - The old slide to compare against
 * @returns true if slides are different, false if same
 */
export const hasSlideChanged = (newSlide: Slide | null, oldSlide: Slide | null): boolean => {
  if (!newSlide || !oldSlide) return true;

  // Compare identity first (fastest check)
  if (newSlide.id !== oldSlide.id) return true;

  // Compare key rendering properties
  if (
    newSlide.index !== oldSlide.index ||
    newSlide.type !== oldSlide.type ||
    newSlide.title !== oldSlide.title
  ) {
    return true;
  }

  // Compare contents array
  if (newSlide.contents?.length !== oldSlide.contents?.length) return true;
  for (let i = 0; i < (newSlide.contents?.length || 0); i++) {
    if (newSlide.contents?.[i] !== oldSlide.contents?.[i]) return true;
  }

  // Compare slideStyle properties that affect rendering
  const newStyle = newSlide.slideStyle;
  const oldStyle = oldSlide.slideStyle;

  if (newStyle?.fontSize !== oldStyle?.fontSize) return true;
  if (newStyle?.font !== oldStyle?.font) return true;
  if (newStyle?.alignment !== oldStyle?.alignment) return true;
  if (newStyle?.textBold !== oldStyle?.textBold) return true;
  if (newStyle?.textOutlined !== oldStyle?.textOutlined) return true;
  if (newStyle?.lettercase !== oldStyle?.lettercase) return true;
  if (newStyle?.lineSpacing !== oldStyle?.lineSpacing) return true;
  if (newStyle?.isMediaPlaying !== oldStyle?.isMediaPlaying) return true;
  if (newStyle?.isMediaMuted !== oldStyle?.isMediaMuted) return true;
  if (newStyle?.mediaSeekPosition !== oldStyle?.mediaSeekPosition) return true;
  if (newStyle?.blur !== oldStyle?.blur) return true;
  if (newStyle?.brightness !== oldStyle?.brightness) return true;
  if (newStyle?.backgroundFillType !== oldStyle?.backgroundFillType) return true;

  // No meaningful changes detected
  return false;
};

/**
 * Creates a lightweight comparison key for a slide
 * Useful for quick equality checks in watchers
 */
export const getSlideComparisonKey = (slide: Slide | null): string => {
  if (!slide) return '';

  return [
    slide.id,
    slide.type,
    slide.title || ''
  ].join('|');
};
