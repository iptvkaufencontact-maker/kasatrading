import AppShell from "@/components/app-shell";
import SessionGate from "@/components/session-gate";
import { authRequired, currentUser } from "@/lib/auth";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) return <SessionGate/>;
  const data = await getAppData(user);
  return <AppShell initialData={data} user={user} authEnabled={authRequired()}/>;
}
