import { z } from 'zod';
import { demoIntent } from '../../../lib/intent';
import { explainRecommendation } from '../../../lib/recommend';
import { resolveCustomerStatus, resolvePlannedCustomerStatus } from '../../../lib/customer-status';
import { AppError, readInput, errorResponse, json } from '../../../lib/server/http';
import { answerGuide, chatContextSchema, resolveSearch } from '../../../lib/chat';
import { executeRequestPlan } from '../../../lib/assistant-execution';
import { contextForAnswer } from '../../../lib/conversation';
import { emptyIntent } from '../../../lib/search-state';
import { RequestClarification } from '../../../lib/request-plan';
import { planRequest, PLANNER_VERSION, PlannerValidationError } from '../../../lib/server/request-planner';
const input = z.object({ prompt: z.string().trim().min(1).max(1000), newCustomer: z.boolean().nullable(), mode: z.enum(['live', 'demo']), context: chatContextSchema.optional() }).strict();
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readInput(request, input);
    const context = body.context ? chatContextSchema.parse(body.context) : undefined;
    let customer = resolveCustomerStatus(body.prompt, body.newCustomer);
    if (body.mode === 'demo') {
      // Legacy phrase matching remains explicitly confined to the basic offline demonstration.
      const help = answerGuide(body.prompt, customer, context);
      const extracted = demoIntent(body.prompt);
      const intent = help ? { ...extracted, intent: help.intent ?? 'unsupported' as const, newCustomer: customer } : resolveSearch(body.prompt, { ...extracted, newCustomer: customer }, context);
      return json({ ...(help ?? explainRecommendation(intent, customer)), intent, newCustomer: customer, mode: 'demo', model: null, promptVersion: PLANNER_VERSION, responseSource: 'demo' });
    }
    const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL;
    if (!key || !model) throw new AppError('Live AI is not configured. Select the labeled basic demo mode.', 503);
    const plan = await planRequest(body.prompt, key, model, context, body.newCustomer);
    customer = resolvePlannedCustomerStatus(body.prompt, body.newCustomer, plan.customerStatement, plan.customerEvidence);
    if (plan.action === 'refuse' || plan.limitations.includes('merchant-status')) customer = body.newCustomer;
    try {
      const result = executeRequestPlan(plan, body.prompt, customer, context, model, PLANNER_VERSION);
      return json({ ...result, conversationContext: contextForAnswer(result, context) ?? null, newCustomer: customer, mode: 'live', model, promptVersion: PLANNER_VERSION, responseSource: 'ai', planAction: plan.action, interpretedRequest: { action: plan.action, scope: plan.scope, topic: plan.topic, limitations: plan.limitations, currency: plan.currency, filters: plan.filters }, appliedChanges: plan.updates.map(update => ({ field: update.field, operation: update.operation })) });
    } catch (error) {
      if (!(error instanceof RequestClarification)) throw error;
      return json({ answer: error.message, offerIds: [], intent: { ...emptyIntent(customer), intent: 'unsupported' }, conversationContext: context ?? null, newCustomer: customer, mode: 'live', model, promptVersion: PLANNER_VERSION, responseSource: 'ai', planAction: 'clarify', appliedChanges: [], interpretedRequest: { action: plan.action, scope: plan.scope, topic: plan.topic, limitations: plan.limitations, currency: plan.currency, filters: plan.filters } });
    }
  } catch (error) {
    if (error instanceof PlannerValidationError) return Response.json({ error: error.message, errorCode: 'PLAN_VALIDATION', invalidFields: error.fields }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    return errorResponse(error);
  }
}
