/**
 * A ceiling on what this deployment may spend on model calls in a day.
 *
 * On 2026-07-26 the provider key hit its OWN daily cap mid-session. The app had
 * no idea: the 402 travelled up as an ordinary upstream failure and every
 * learner got "the AI could not be reached", which is both wrong and unhelpful.
 * Worse, nothing in the app could have prevented it — there was no accounting at
 * all, so a public URL and a provider key were the only two things between a
 * stranger and an unbounded bill.
 *
 * Two pieces, deliberately simple:
 *  - spend is recorded per UTC day in the database, because serverless
 *    instances share nothing else;
 *  - the check runs BEFORE a call, so the ceiling is ours and the failure is a
 *    sentence a learner can act on rather than a provider error code.
 *
 * Costs come from the provider's own usage accounting, not an estimate — a
 * guessed price would drift from reality exactly when it matters.
 */
import { prisma } from "@/lib/db/prisma";
import { reportError, reportWarn } from "@/lib/observability/report";

/** Dollars per day. Unset or 0 = no ceiling (self-hosted default). */
export function dailyBudgetUsd(): number {
  const n = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export class BudgetExhaustedError extends Error {
  readonly status = 429;
  constructor(spentUsd: number, limitUsd: number) {
    super(`Daily AI budget exhausted: $${spentUsd.toFixed(4)} of $${limitUsd.toFixed(2)}`);
    this.name = "BudgetExhaustedError";
  }
}

export type SpendToday = { microUsd: number; calls: number; usd: number };

export async function spendToday(day = todayKey()): Promise<SpendToday> {
  const row = await prisma.aiSpend.findUnique({ where: { day } });
  const microUsd = row?.microUsd ?? 0;
  return { microUsd, calls: row?.calls ?? 0, usd: microUsd / 1_000_000 };
}

/**
 * Throw if today's budget is already spent. Called before every model call.
 *
 * A database that cannot be read must NOT block learning: the ledger is a cost
 * guard, and failing closed on it would turn a monitoring problem into an
 * outage. It fails open and says so in the log.
 */
export async function assertWithinBudget(): Promise<void> {
  const limit = dailyBudgetUsd();
  if (!limit) return;
  try {
    const { usd } = await spendToday();
    if (usd >= limit) throw new BudgetExhaustedError(usd, limit);
  } catch (err) {
    if (err instanceof BudgetExhaustedError) throw err;
    reportError("llm/budget", "could not read the spend ledger — allowing the call", err);
  }
}

/**
 * Record what a call cost. Never throws: losing a ledger write is a reporting
 * problem, while turning it into a request failure would be a product problem.
 */
export async function recordSpend(usd: number, model: string): Promise<void> {
  if (!(usd > 0)) return;
  const micro = Math.round(usd * 1_000_000);
  const day = todayKey();
  try {
    await prisma.aiSpend.upsert({
      where: { day },
      // Atomic increments: concurrent lambdas must not overwrite each other's
      // totals, which a read-modify-write would do under any real load.
      update: { microUsd: { increment: micro }, calls: { increment: 1 } },
      create: { day, microUsd: micro, calls: 1 },
    });
    const limit = dailyBudgetUsd();
    if (limit) {
      const { usd: total } = await spendToday(day);
      // One warning as the budget runs out, so the ceiling is not a surprise.
      if (total >= limit * 0.8 && total - usd < limit * 0.8) {
        reportWarn("llm/budget", "daily AI budget 80% spent", { total, limit, model });
      }
    }
  } catch (err) {
    reportError("llm/budget", "could not record spend", err, { usd, model });
  }
}

/** Is this failure the provider telling us IT is out of credit? */
export function isProviderBudgetError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e?.status === 402) return true;
  return /more credits|insufficient|quota exceeded|billing/i.test(String(e?.message ?? ""));
}
