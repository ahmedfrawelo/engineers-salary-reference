export function normalizeLookupName(input: string): string {
  const name = (input ?? '').trim();
  if (!name) {
    throw new Error('Lookup name is required');
  }
  return name;
}
