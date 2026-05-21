import { CategoryManagementClient } from "@/components/categories/CategoryManagementClient";
import { requirePageAdmin } from "@/lib/page-auth";

export default async function CategoriesPage() {
  await requirePageAdmin();

  return <CategoryManagementClient />;
}
