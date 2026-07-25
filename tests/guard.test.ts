import { describe, it, expect } from "vitest";
import { checkInterestText } from "@/lib/profile/guard";

const blocked = (s: string) => checkInterestText(s).ok === false;
const allowed = (s: string) => checkInterestText(s).ok === true;

describe("privacy guard", () => {
  it("refuses sensitive disclosures in English", () => {
    expect(blocked("I have depression")).toBe(true);
    expect(blocked("my mom and dad")).toBe(true);
    expect(blocked("my gender identity")).toBe(true);
  });

  // The guard used to be English-only, which protected only the learners who
  // happened to type in English — in an app that ships in ten languages.
  it("refuses the same disclosures in the other nine languages", () => {
    expect(blocked("ich habe Depressionen")).toBe(true); // de
    expect(blocked("meine Mutter")).toBe(true);
    expect(blocked("tengo ansiedad")).toBe(true); // es
    expect(blocked("mi madre")).toBe(true);
    expect(blocked("ma maladie")).toBe(true); // fr
    expect(blocked("mio fratello")).toBe(true); // it
    expect(blocked("a minha família")).toBe(true); // pt
    expect(blocked("annem")).toBe(true); // tr
    expect(blocked("moja siostra")).toBe(true); // pl
    expect(blocked("моя мама")).toBe(true); // uk
    expect(blocked("أمي")).toBe(true); // ar
  });

  it("catches inflections, not just exact words", () => {
    expect(blocked("Depressionen")).toBe(true);
    expect(blocked("depressed lately")).toBe(true);
    expect(blocked("meine Krankheit")).toBe(true);
  });

  it("lets ordinary interests through, including the near misses", () => {
    // The audience for this app plays games and watches motorsport: a guard
    // that refuses these teaches them the field is broken, not careful.
    expect(allowed("God of War")).toBe(true);
    expect(allowed("Greek gods and mythology")).toBe(true);
    expect(allowed("drag race")).toBe(true);
    expect(allowed("Formel 1")).toBe(true);
    expect(allowed("Klettern und Bouldern")).toBe(true);
    expect(allowed("competitive gaming")).toBe(true);
    expect(allowed("horse riding")).toBe(true);
    expect(allowed("baking sourdough")).toBe(true);
  });

  it("does not match inside unrelated words", () => {
    // Turkish "din" (religion) opens "dinlemek" (to listen); a prefix match
    // there would refuse a perfectly normal answer.
    expect(allowed("müzik dinlemek")).toBe(true);
    expect(allowed("Papageien")).toBe(true); // starts with "papa"
    expect(allowed("Bratwurst grillen")).toBe(true); // starts with "brat"
  });

  it("treats empty input as fine", () => {
    expect(allowed("")).toBe(true);
    expect(allowed("   ")).toBe(true);
  });

  it("reports which topic tripped, for the message the learner sees", () => {
    const r = checkInterestText("meine Depressionen");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.topic).toBe("health");
  });
});
