#!/usr/bin/env node

import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./db-utils.mjs";

const DEMO_ACCOUNTS = [
  {
    email: "jordan-basic@prelude-demo.com",
    password: "Student123!",
    firstName: "Jordan",
    lastName: "Lee",
    role: "STUDENT",
    plan: "BASIC"
  },
  {
    email: "jordan-plus@prelude-demo.com",
    password: "Student123!",
    firstName: "Jordan",
    lastName: "Lee",
    role: "STUDENT",
    plan: "PLUS"
  },
  {
    email: "jordan-pro@prelude-demo.com",
    password: "Student123!",
    firstName: "Jordan",
    lastName: "Lee",
    role: "STUDENT",
    plan: "PRO"
  },
  {
    email: "student@prelude-demo.com",
    password: "Student123!",
    firstName: "Jordan",
    lastName: "Lee",
    role: "STUDENT",
    plan: "PLUS"
  },
  {
    email: "student2@prelude-demo.com",
    password: "Student123!",
    firstName: "Alex",
    lastName: "Kim",
    role: "STUDENT",
    plan: "BASIC"
  },
  {
    email: "mentor@prelude-demo.com",
    password: "Mentor123!",
    firstName: "Maya",
    lastName: "Chen",
    role: "MENTOR"
  }
];

async function upsertDemoAccount(prisma, account) {
  const email = account.email.toLowerCase();
  const passwordHash = await argon2.hash(account.password, { type: argon2.argon2id });
  const existing = await prisma.user.findUnique({ where: { email } });

  const userData = {
    firstName: account.firstName,
    lastName: account.lastName,
    passwordHash,
    role: account.role,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    status: "ACTIVE",
    failedLoginCount: 0,
    lockedUntil: null,
    ...(account.plan ? { plan: account.plan } : {})
  };

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: userData
    });
    if (account.role === "STUDENT") {
      await prisma.studentProfile.upsert({
        where: { userId: existing.id },
        update: {},
        create: { userId: existing.id }
      });
    }
    if (account.role === "MENTOR") {
      await prisma.mentorProfile.upsert({
        where: { userId: existing.id },
        update: {},
        create: { userId: existing.id }
      });
    }
    return "updated";
  }

  const user = await prisma.user.create({
    data: {
      ...userData,
      email,
      termsAcceptedAt: new Date()
    }
  });

  if (account.role === "STUDENT") {
    await prisma.studentProfile.create({ data: { userId: user.id } });
  }
  if (account.role === "MENTOR") {
    await prisma.mentorProfile.create({ data: { userId: user.id } });
  }

  return "created";
}

async function main() {
  process.env.DATABASE_URL = databaseUrl();
  const prisma = new PrismaClient();

  try {
    for (const account of DEMO_ACCOUNTS) {
      const action = await upsertDemoAccount(prisma, account);
      const planLabel = account.plan ? ` · ${account.plan}` : "";
      console.log(`${action} ${account.role.toLowerCase()} demo account (${account.email}${planLabel})`);
    }
    console.log("");
    console.log("Jordan plan demos:");
    console.log("  Basic: jordan-basic@prelude-demo.com / Student123!");
    console.log("  Plus:  jordan-plus@prelude-demo.com / Student123!");
    console.log("  Pro:   jordan-pro@prelude-demo.com / Student123!");
    console.log("");
    console.log("Parent demo (Sam Lee / parent@prelude-demo.com) uses Supabase fixtures.");
    console.log("Sign in via the demo parent button, or run supabase/seed-demo-parent-links.sql after creating Supabase demo users.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
