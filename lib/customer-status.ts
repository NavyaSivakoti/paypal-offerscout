const declarationPrefix = String.raw`(?:^|[.!?:;]\s+|,\s*)i(?:\s+am|'m)\s+`;
const returningDeclaration = new RegExp(
  declarationPrefix + String.raw`(?:(?:a\s+)?(?:returning|existing|repeat)|not\s+(?:a\s+)?new)\s+customer\b`,
  'i',
);
const newDeclaration = new RegExp(
  declarationPrefix + String.raw`(?:a\s+)?new\s+customer\b`,
  'i',
);

export function readCustomerDeclaration(prompt: string): 'new' | 'returning' | 'conflict' | 'none' {
  const normalized = prompt.normalize('NFKC').replace(/"[^"]*"|“[^”]*”/g, ' ').replace(/[‘’]/g, "'");
  const returning = returningDeclaration.test(normalized), fresh = newDeclaration.test(normalized);
  return returning && fresh ? 'conflict' : returning ? 'returning' : fresh ? 'new' : 'none';
}
/** Eligibility is a user declaration, never an inference from requested deals. */
export function resolveCustomerStatus(prompt: string, selected: boolean | null): boolean | null {
  const declaration = readCustomerDeclaration(prompt);
  return declaration === 'conflict' ? null : declaration === 'returning' ? false : declaration === 'new' ? true : selected;
}

/** The model proposes a declaration; code verifies its literal evidence and first-person form. */
export function resolvePlannedCustomerStatus(prompt: string, selected: boolean | null, statement: 'new' | 'returning' | 'conflicting' | 'none', evidence: string | null): boolean | null {
  // An unmistakable direct declaration is deterministic input, even if the planner omitted it.
  const ownDirect = /^(?:(?:actually|correction)[,:]?\s+)?i(?:\s+am|'m)\s+(?:(?:a\s+)?(?:new|returning|existing|repeat)|not\s+(?:a\s+)?new)\s+customer\b/i.test(prompt.normalize('NFKC').replace(/[‘’]/g, "'").trim());
  if (ownDirect) {
    const direct = readCustomerDeclaration(prompt);
    if (direct === 'conflict') return null;
    if (direct === 'new') return true;
    if (direct === 'returning') return false;
  }
  if (statement === 'none' || evidence === null) return selected;
  const normalize = (value: string): string => value.normalize('NFKC').replace(/[‘’]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalize(prompt).includes(normalize(evidence))) return selected;
  const declaration = readCustomerDeclaration(prompt);
  if (declaration === 'conflict') return null;
  if (declaration === 'new' && statement === 'new') return true;
  if (declaration === 'returning' && statement === 'returning') return false;
  return selected;
}
