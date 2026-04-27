import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { UserRole } from "@/lib/user-roles";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing username or password");
        }

        const user = await prisma.user.findUnique({
          where: {
            username: credentials.username,
          },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.isActive === false) {
          throw new Error("User is inactive");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = user.role;
        token.username = user.username;
        token.isActive = user.isActive;
      }

      if (token.id) {
        const persistedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, username: true, role: true, isActive: true },
        });

        if (persistedUser) {
          token.name = persistedUser.name;
          token.username = persistedUser.username;
          token.role = persistedUser.role;
          token.isActive = persistedUser.isActive;
        } else {
          token.isActive = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name || token.username) as string;
        session.user.role = token.role as UserRole;
        session.user.username = token.username as string;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
