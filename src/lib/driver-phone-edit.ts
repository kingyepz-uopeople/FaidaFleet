/** Translate only the identity trigger's phone-change refusal, not other errors. */
export function driverPhoneEditError(message: string | undefined, previousPhone: string | undefined, nextPhone: string): string | null {
  if (message === 'Driver login and phone cannot be changed directly' && previousPhone !== undefined && previousPhone !== nextPhone) {
    return 'The PIN login belongs to this phone number. Leave the phone unchanged, or recreate the driver to use a different phone number.'
  }
  return null
}
