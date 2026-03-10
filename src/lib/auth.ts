import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const doctor = await prisma.doctor.findUnique({
          where: { email: parsed.data.email },
        });

        if (!doctor) {
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, doctor.password);
        if (!valid) {
          return null;
        }

        return {
          id: doctor.id,
          email: doctor.email,
          name: doctor.name,
          role: doctor.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = typeof token.role === "string" ? token.role : "General Physician";
      }
      return session;
    },
  },
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
