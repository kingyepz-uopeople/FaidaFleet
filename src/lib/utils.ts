import { clsx, type ClassValue } from "clsx"
import * as tm from "tailwind-merge"

type MergeFn = (value: string) => string
const candidate = tm as unknown as { twMerge?: MergeFn; default?: MergeFn | { twMerge?: MergeFn } }
const fromDefault = typeof candidate.default === "function" ? candidate.default : candidate.default?.twMerge
const mergeFn: MergeFn | undefined = candidate.twMerge || fromDefault

export function cn(...inputs: ClassValue[]) {
  return mergeFn ? mergeFn(clsx(inputs)) : clsx(inputs)
}
