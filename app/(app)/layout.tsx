import { redirect } from "next/navigation";
import { getCurrentLearner } from "@/lib/db/learner";

/**
 * Authoritative auth guard for every personal screen.
 *
 * The edge middleware can only see whether a cookie EXISTS — it cannot query
 * the database. A cookie that outlived its learner (recycled instance, wiped
 * demo data, deleted profile) would sail straight through. This layout runs on
 * the server and actually resolves the learner, so a stale session can never
 * reach onboarding, capture, the map, the brain or a learn session.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const learner = await getCurrentLearner();
  if (!learner) redirect("/signin?expired=1");
  return <>{children}</>;
}
