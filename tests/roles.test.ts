import { describe, it, expect, afterEach } from "vitest";
import { teacherCodeValid, generateJoinCode, normalizeJoinCode, isTeacher, isRole } from "@/lib/auth/roles";

const ORIGINAL = process.env.TEACHER_UNLOCK_CODE;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TEACHER_UNLOCK_CODE;
  else process.env.TEACHER_UNLOCK_CODE = ORIGINAL;
});

describe("teacherCodeValid", () => {
  it("accepts the configured code", () => {
    process.env.TEACHER_UNLOCK_CODE = "lehrer-geheim-2026";
    expect(teacherCodeValid("lehrer-geheim-2026")).toBe(true);
    expect(teacherCodeValid("  lehrer-geheim-2026  ")).toBe(true);
  });

  it("rejects a wrong code", () => {
    process.env.TEACHER_UNLOCK_CODE = "lehrer-geheim-2026";
    expect(teacherCodeValid("lehrer-geheim-2025")).toBe(false);
    expect(teacherCodeValid("lehrer")).toBe(false);
  });

  // The trap a plain `code === process.env.X` walks into: on a host that never
  // configured the feature, both sides are "" and everyone becomes a teacher.
  it("refuses everything when the host has no code configured", () => {
    delete process.env.TEACHER_UNLOCK_CODE;
    expect(teacherCodeValid("")).toBe(false);
    expect(teacherCodeValid(undefined)).toBe(false);
    expect(teacherCodeValid("anything")).toBe(false);
    process.env.TEACHER_UNLOCK_CODE = "   ";
    expect(teacherCodeValid("   ")).toBe(false);
  });
});

describe("roles", () => {
  it("recognizes only the known roles", () => {
    expect(isRole("learner")).toBe(true);
    expect(isRole("teacher")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("treats a missing role as not-a-teacher", () => {
    expect(isTeacher({ role: "teacher" })).toBe(true);
    expect(isTeacher({ role: "learner" })).toBe(false);
    expect(isTeacher({})).toBe(false);
    expect(isTeacher({ role: null })).toBe(false);
  });
});

describe("join codes", () => {
  it("formats as XXXX-XXXX from the given bytes", () => {
    const code = generateJoinCode(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  // Read aloud to a class, then typed by children: the easily-confused
  // characters must not be in the alphabet at all.
  it("never emits 0, O, 1, I or L", () => {
    for (let b = 0; b < 256; b += 1) {
      const code = generateJoinCode(Uint8Array.from(Array(8).fill(b)));
      expect(code.replace("-", "")).not.toMatch(/[01OIL]/);
    }
  });

  it("normalizes what a learner actually types", () => {
    expect(normalizeJoinCode("abcd2345")).toBe("ABCD-2345");
    expect(normalizeJoinCode("ABCD-2345")).toBe("ABCD-2345");
    expect(normalizeJoinCode(" abcd 2345 ")).toBe("ABCD-2345");
    expect(normalizeJoinCode("abcd_2345")).toBe("ABCD-2345");
  });
});
