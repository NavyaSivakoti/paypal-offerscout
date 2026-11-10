import { z } from 'zod';
import { intentSchema, type ShoppingIntent } from './intent.ts';

// Only catalog constraints and a limitation code are retained, never health history or payment data.
export const pendingComparisonSchema = z.object({
  intent: intentSchema,
  limitation: z.enum(['attributes', 'medical']),
}).strict();
export const chatContextSchema = z.object({
  intent: intentSchema,
  offerIds: z.array(z.string().max(80)).max(12),
  pendingComparison: pendingComparisonSchema.optional(),
}).strict();
export type ChatContext = z.infer<typeof chatContextSchema>;

interface ContextualAnswer {
  intent: ShoppingIntent;
  offerIds: string[];
  conversationContext?: ChatContext | null;
}

/** Shared by the API and UI: a new question must not accidentally accept a stale offer. */
export function contextForAnswer(answer: ContextualAnswer, previous?: ChatContext): ChatContext | undefined {
  if (answer.conversationContext !== undefined) return answer.conversationContext === null ? undefined : chatContextSchema.parse(answer.conversationContext);
  if (answer.intent.intent === 'search') return chatContextSchema.parse({ intent: answer.intent, offerIds: answer.offerIds });
  return previous ? { intent: previous.intent, offerIds: previous.offerIds } : undefined;
}
