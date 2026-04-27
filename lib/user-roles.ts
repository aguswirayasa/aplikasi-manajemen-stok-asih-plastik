import type { Role } from "@/generated/prisma/client";

export const USER_ROLES = ["ADMIN", "PEGAWAI"] as const satisfies readonly Role[];

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
