import { clsx, type ClassValue } from "clsx"
import * as tm from "tailwind-merge"

const mergeFn = typeof tm.twMerge === "function" ? tm.twMerge : (tm as any).default?.twMerge || (tm as any).default

export function cn(...inputs: ClassValue[]) {
  return typeof mergeFn === "function" ? mergeFn(clsx(inputs)) : clsx(inputs)
}
