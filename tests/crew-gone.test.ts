import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CrewAI is removed from the production path", () => {
  it("debate does not import a crew bridge", () => {
    const debate = readFileSync(resolve(process.cwd(), "lib/desk/debate.ts"), "utf8");
    expect(debate).not.toMatch(/crew-bridge/);
    expect(debate).not.toMatch(/debateViaCrew/);
    expect(debate).not.toMatch(/CREW_/);
  });

  it("env example and README do not require Crew", () => {
    const env = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    expect(env).not.toMatch(/CREW_/);
    expect(readme).not.toMatch(/CrewAI/);
    expect(readme).toMatch(/Groq org A/);
  });
});
