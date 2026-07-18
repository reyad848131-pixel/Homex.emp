import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const isProduction = process.env.NODE_ENV === "production";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        civilId: { label: "Civil ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.civilId || !credentials?.password) return null;

        const employee = await prisma.employee.findUnique({
          where: { civilId: credentials.civilId },
        });

        if (!employee || !employee.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, employee.password);
        if (!valid) return null;

        await prisma.employee.update({
          where: { id: employee.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: employee.id,
          name: employee.name,
          civilId: employee.civilId,
          role: employee.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.civilId = (user as any).civilId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).civilId = token.civilId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
      },
    },
    csrfToken: {
      name: isProduction ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
      },
    },
    callbackUrl: {
      name: isProduction ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
      },
    },
  },
} satisfies NextAuthOptions;
