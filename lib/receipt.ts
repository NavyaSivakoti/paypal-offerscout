import { z } from 'zod';
const cents = z.number().int().nonnegative();
export const receiptSchema = z.object({
  orderId: z.string().min(1), captureId: z.string().min(1), paidCents: cents,
  status: z.literal('COMPLETED'), sandbox: z.literal(true),
  offerId: z.string().min(1), merchant: z.string().min(1), product: z.string().min(1),
  merchandiseCents: cents, shippingCents: cents, instantDiscountCents: cents,
  estimatedCashbackCents: cents, estimatedEffectiveCents: cents,
  eligibilityMet: z.boolean(), eligibilityReason: z.string().min(1),
  customerStatus: z.enum(['unknown', 'self-declared-new', 'returning']),
  estimateAsOf: z.literal('2026-10-17'), rewardsAreSimulated: z.literal(true),
}).strict().superRefine((value, context) => {
  if (value.paidCents + value.instantDiscountCents !== value.merchandiseCents + value.shippingCents)
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment breakdown does not balance.' });
  if (value.estimatedEffectiveCents + value.estimatedCashbackCents !== value.paidCents)
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cashback estimate does not balance.' });
  if (!value.eligibilityMet && (value.estimatedCashbackCents !== 0 || value.instantDiscountCents !== 0))
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Ineligible offers cannot provide a benefit.' });
  if (value.estimatedCashbackCents > value.merchandiseCents || value.instantDiscountCents > value.merchandiseCents)
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Benefit exceeds merchandise amount.' });
  if (value.estimatedCashbackCents && value.instantDiscountCents)
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'This prototype does not stack benefits.' });
});
export type PaymentReceipt = z.infer<typeof receiptSchema>;
