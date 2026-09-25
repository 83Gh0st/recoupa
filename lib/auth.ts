import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, credentials.email.toLowerCase().trim()))
          .limit(1);

        if (!user || !user.isActive) return null;

        const [tenant] = await db
          .select()
          .from(schema.tenants)
          .where(and(eq(schema.tenants.id, user.tenantId), eq(schema.tenants.isActive, true)))
          .limit(1);

        if (!tenant) return null; // tenant deactivated blocks everyone in it

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: tenant.name,
          currency: tenant.currency,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
        token.currency = (user as any).currency;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.userId as string,
        role: token.role as "OWNER" | "MANAGER" | "COLLECTOR" | "SALES" | "CLIENT",
        tenantId: token.tenantId as string,
        tenantName: token.tenantName as string,
        currency: token.currency as string,
      };
      return session;
    },
  },
};

// Module augmentation so `session.user.role` etc. are typed everywhere.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: "OWNER" | "MANAGER" | "COLLECTOR" | "SALES" | "CLIENT";
      tenantId: string;
      tenantName: string;
      currency: string;
    };
  }
}
