const declarationPrefix = String.raw`(?:^|[.!?]\s+)i(?:\s+am|'m)\s+`;
const returningDeclaration = new RegExp(
  declarationPrefix + String.raw`(?:(?:a\s+)?(?:returning|existing|repeat)|not\s+(?:a\s+)?new)\s+customer\b`,
  'i',
);
const newDeclaration = new RegExp(
  declarationPrefix + String.raw`(?:a\s+)?new\s+customer\b`,
  'i',
);

/** Eligibility is a user declaration, never an inference from requested deals. */
export function resolveCustomerStatus(prompt: string, selected: boolean | null): boolean | null {
  const normalized = prompt.normalize('NFKC').replace(/[‘’]/g, "'");
  const returning = returningDeclaration.test(normalized);
  const fresh = newDeclaration.test(normalized);
  if (returning && fresh) return null;
  if (returning) return false;
  if (fresh) return true;
  return selected;
}
