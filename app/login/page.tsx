import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { authOptions } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (
    session?.user &&
    session.user.isActive === true &&
    Number.isInteger(session.user.sessionVersion)
  ) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
