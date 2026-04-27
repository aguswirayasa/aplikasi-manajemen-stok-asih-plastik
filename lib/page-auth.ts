import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requirePageAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.isActive === false) {
    redirect("/login");
  }

  return session.user;
}

export async function requirePageAdmin() {
  const user = await requirePageAuth();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
