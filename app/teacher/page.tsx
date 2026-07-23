import { redirect } from "next/navigation";

// Teacher view is a future/premium feature — parked until it is
// production-ready. The full implementation lives in ./teacher-page.tsx.
export default function TeacherGate() {
  redirect("/");
}
