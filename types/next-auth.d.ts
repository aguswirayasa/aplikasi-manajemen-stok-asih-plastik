import { DefaultSession, DefaultUser } from "next-auth";
import type { UserRole } from "@/lib/user-roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: UserRole;
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    name: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  }
}
