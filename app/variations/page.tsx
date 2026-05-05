import { VariationManagementClient } from "@/components/variations/VariationManagementClient";
import { requirePageAdmin } from "@/lib/page-auth";

export default async function VariationsPage() {
  await requirePageAdmin();

  return <VariationManagementClient />;
}
