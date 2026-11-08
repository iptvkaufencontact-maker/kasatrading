import { redirect } from "next/navigation";
import { authRequired, currentUser, DEFAULT_ADMIN, defaultPasswordStillActive, ensureDefaultUser } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!authRequired() || await currentUser()) redirect("/");
  await ensureDefaultUser();
  const hint = (await defaultPasswordStillActive()) ? { email: DEFAULT_ADMIN.email, password: DEFAULT_ADMIN.password } : null;
  return <LoginForm hint={hint} />;
}
