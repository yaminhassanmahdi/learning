import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to trigger ProButton dialog
export const triggerProButtonDialog = () => {
  // Find the ProButton component and trigger its dialog
  const proButton = document.querySelector('[data-pro-button="true"]') as HTMLElement;
  if (proButton) {
    proButton.click();
  } else {
    // Fallback: try to find any button with "Get Pro" text
    const getProButton = Array.from(document.querySelectorAll('button')).find(
      button => button.textContent?.includes('Get Pro')
    ) as HTMLElement;
    if (getProButton) {
      getProButton.click();
    }
  }
};
