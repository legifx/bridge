import { prisma } from "@/lib/db/prisma";
import type { Verdict } from "./types";

export type LogEntry = {
  id: string;
  conceptLabel: string;
  domainName: string;
  status: "accepted" | "rejected";
  attempt: number;
  isFallback: boolean;
  verdict: Verdict;
  preview: string;
  createdAt: string;
};

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Recent accepted/rejected bridges for the verification log (§5). */
export async function getVerificationLog(learnerId: string, limit = 30): Promise<LogEntry[]> {
  const rows = await prisma.bridge.findMany({
    where: { concept: { learnerId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { concept: { select: { label: true } }, domain: { select: { name: true } } },
  });

  return rows.map((r) => {
    const v = safeParse<Verdict & { fallback?: boolean }>(r.verdictJson, {
      factuallyConsistent: true,
      contradictions: [],
      analogyOverreach: false,
      verdict: "accept",
    });
    const body = safeParse<{ opening?: string; plainRestatement?: string }>(r.body, {});
    return {
      id: r.id,
      conceptLabel: r.concept.label,
      domainName: r.domain.name,
      status: r.status as "accepted" | "rejected",
      attempt: r.attempt,
      isFallback: Boolean(v.fallback),
      verdict: v,
      preview: body.opening ?? body.plainRestatement ?? "",
      createdAt: r.createdAt.toISOString(),
    };
  });
}
