import { UserManagementClient } from "@/components/users/UserManagementClient";
import { requirePageAdmin } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requirePageAdmin();

  return <UserManagementClient currentUserId={user.id} />;
}
