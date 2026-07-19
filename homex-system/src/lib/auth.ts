import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        civilId: { label: "Civil ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
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
          }).catch(() => {});

          return {
            id: employee.id,
            name: employee.name,
            civilId: employee.civilId,
            role: employee.role,
          };
        } catch (e) {
          console.error("authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = (user as any).role;
        token.civilId = (user as any).civilId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).name = token.name;
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
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
};

export async function getAuth() {
  const secret = process.env.NEXTAUTH_SECRET!;
  const cookieStore = await cookies();
  const cookieNames = [
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ];

  for (const name of cookieNames) {
    const value = cookieStore.get(name)?.value;
    if (!value) continue;
    try {
      const token = await decode({ token: value, secret, salt: name });
      if (token) {
        return {
          user: {
            id: token.id as string,
            name: token.name as string,
            role: token.role as string,
            civilId: token.civilId as string,
          },
        };
      }
    } catch {}
  }
  return null;
}
