import { redirect } from "next/navigation";

// Root page — auth check happens client-side in the dashboard layout via AuthGuard.
// We simply redirect all visitors to the login page.
export default function RootPage() {
  redirect("/login");
}
