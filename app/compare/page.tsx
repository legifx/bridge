import { redirect } from "next/navigation";

// Compare view is a future/premium feature — parked until it is
// production-ready. The full implementation lives in ./compare-page.tsx.
export default function CompareGate() {
  redirect("/");
}
