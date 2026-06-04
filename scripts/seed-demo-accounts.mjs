/**
 * LOCAL DEVELOPMENT ONLY — seeds demo student/mentor accounts into PostgreSQL.
 * Usage: npm run seed:demo
 * Requires DATABASE_URL in .env
 */

import "../server/loadEnv.js";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_DEMO_ACCOUNTS } from "../src/data/demoAccounts.js";
import { DEMO_SLUGS, getDemoMeetingsSeedPayload } from "../src/data/demoDashboardData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEETINGS_FILE = join(__dirname, "../server/data/meetings.json");

const prisma = new PrismaClient();

async function upsertDemoUser(account) {
  const email = account.email.toLowerCase();
  const passwordHash = await argon2.hash(account.password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      firstName: account.firstName,
      lastName: account.lastName,
      email,
      passwordHash,
      role: account.role,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date()
    },
    update: {
      firstName: account.firstName,
      lastName: account.lastName,
      passwordHash,
      role: account.role,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "ACTIVE"
    }
  });
  return user;
}

async function ensureProfiles(users) {
  const mentor = users.mentor;
  const jordan = users.jordan;
  const alex = users.alex;

  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId: mentor.id },
    create: {
      userId: mentor.id,
      college: "Georgia Institute of Technology",
      major: "Computer Science",
      bio: "Maya is a Georgia Tech graduate who helps students organize their college applications, strengthen their essays, and create realistic college lists.",
      specialties: ["STEM applications", "College list strategy", "Essay feedback", "Scholarship planning", "Time management"],
      hourlyAvailability: {
        slots: [
          { day: "Tuesday", time: "4:00–6:00 PM ET" },
          { day: "Thursday", time: "3:00–5:00 PM ET" }
        ]
      }
    },
    update: {
      college: "Georgia Institute of Technology",
      major: "Computer Science",
      bio: "Maya is a Georgia Tech graduate who helps students organize their college applications, strengthen their essays, and create realistic college lists.",
      specialties: ["STEM applications", "College list strategy", "Essay feedback", "Scholarship planning", "Time management"]
    }
  });

  const jordanProfile = await prisma.studentProfile.upsert({
    where: { userId: jordan.id },
    create: {
      userId: jordan.id,
      graduationYear: 2027,
      highSchool: "Demo High School",
      location: "Atlanta, GA",
      targetMajors: ["Computer Science", "Data Science"],
      gpa: 3.86,
      testScores: { sat: 1420, weightedGpa: 4.21 },
      progress: { profileCompletion: 78 },
      preferences: {
        colleges: ["Georgia Tech", "UCLA", "University of Michigan", "Northeastern University", "University of Georgia"]
      }
    },
    update: {
      graduationYear: 2027,
      targetMajors: ["Computer Science", "Data Science"],
      gpa: 3.86,
      testScores: { sat: 1420, weightedGpa: 4.21 },
      progress: { profileCompletion: 78 }
    }
  });

  const alexProfile = await prisma.studentProfile.upsert({
    where: { userId: alex.id },
    create: {
      userId: alex.id,
      graduationYear: 2026,
      highSchool: "Demo High School",
      location: "Atlanta, GA",
      targetMajors: ["Economics", "Business"],
      gpa: 3.72,
      testScores: { sat: 1360, weightedGpa: 4.05 },
      progress: { profileCompletion: 64 },
      preferences: { colleges: ["NYU", "Boston University", "Emory University", "University of Georgia"] }
    },
    update: {
      graduationYear: 2026,
      targetMajors: ["Economics", "Business"],
      gpa: 3.72,
      testScores: { sat: 1360, weightedGpa: 4.05 },
      progress: { profileCompletion: 64 }
    }
  });

  await prisma.mentorAssignment.upsert({
    where: {
      mentorProfileId_studentProfileId: {
        mentorProfileId: mentorProfile.id,
        studentProfileId: jordanProfile.id
      }
    },
    create: { mentorProfileId: mentorProfile.id, studentProfileId: jordanProfile.id, active: true },
    update: { active: true }
  });

  await prisma.mentorAssignment.upsert({
    where: {
      mentorProfileId_studentProfileId: {
        mentorProfileId: mentorProfile.id,
        studentProfileId: alexProfile.id
      }
    },
    create: { mentorProfileId: mentorProfile.id, studentProfileId: alexProfile.id, active: true },
    update: { active: true }
  });

  return { mentor, jordan, alex, mentorProfile, jordanProfile, alexProfile };
}

function writeMeetingsFile(ids) {
  const meetings = getDemoMeetingsSeedPayload().map((m) => ({
    ...m,
    studentId: m.studentId === DEMO_SLUGS.jordan ? ids.jordanProfileId : ids.alexProfileId,
    mentorId: ids.mentorProfileId,
    studentUserId: m.studentId === DEMO_SLUGS.jordan ? ids.jordanUserId : ids.alexUserId,
    mentorUserId: ids.mentorUserId
  }));

  const dir = dirname(MEETINGS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MEETINGS_FILE, JSON.stringify({ meetings }, null, 2));
  return meetings.length;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Copy .env.example to .env, then run: npm run db:start");
    process.exit(1);
  }

  const mentorUser = await upsertDemoUser(ALL_DEMO_ACCOUNTS.find((a) => a.key === "mentor"));
  const jordanUser = await upsertDemoUser(ALL_DEMO_ACCOUNTS.find((a) => a.key === "student"));
  const alexUser = await upsertDemoUser(ALL_DEMO_ACCOUNTS.find((a) => a.key === "student2"));

  const profiles = await ensureProfiles({ mentor: mentorUser, jordan: jordanUser, alex: alexUser });
  const meetingCount = writeMeetingsFile({
    mentorUserId: mentorUser.id,
    jordanUserId: jordanUser.id,
    alexUserId: alexUser.id,
    mentorProfileId: profiles.mentorProfile.id,
    jordanProfileId: profiles.jordanProfile.id,
    alexProfileId: profiles.alexProfile.id
  });

  console.info("Demo accounts ready (local development only):\n");
  for (const account of ALL_DEMO_ACCOUNTS) {
    console.info(`  ${account.role.padEnd(7)} ${account.email} / ${account.password}`);
  }
  console.info(`\nSeeded ${meetingCount} demo meetings → server/data/meetings.json`);
  console.info("Students route to /dashboard/student · Mentors route to /dashboard/mentor\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
