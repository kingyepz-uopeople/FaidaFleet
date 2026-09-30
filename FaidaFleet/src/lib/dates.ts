const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Calendar date from a `YYYY-MM-DD` value, interpreted in local time. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateOnly(value: string): string {
  const date = parseDateOnly(value)
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`
}

export function weekdayShort(value: string): string {
  return WEEKDAYS[parseDateOnly(value).getDay()]
}

export function lastNDateKeys(count: number, today = new Date()): string[] {
  const dates: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    dates.push(`${date.getFullYear()}-${month}-${day}`)
  }
  return dates
}

export function isDateBeforeToday(value: string, today = new Date()): boolean {
  return parseDateOnly(value).getTime() < startOfDay(today).getTime()
}

export function daysUntil(value: string, today = new Date()): number {
  const milliseconds = parseDateOnly(value).getTime() - startOfDay(today).getTime()
  return Math.round(milliseconds / 86_400_000)
}

/** True when the date is today or within `days` calendar days, and not already past. */
export function isExpiringWithin(value: string, days: number, today = new Date()): boolean {
  const remaining = daysUntil(value, today)
  return remaining >= 0 && remaining <= days
}
