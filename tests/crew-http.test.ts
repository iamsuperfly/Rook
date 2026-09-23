import { describe, expect, it } from "vitest";
import { crewHttpUrl } from "@/lib/desk/crew-bridge";

describe("crewHttpUrl", () => {
  it("treats empty as unset", () => {
    const prev = process.env.CREW_HTTP_URL;
    delete process.env.CREW_HTTP_URL;
    expect(crewHttpUrl()).toBeNull();
    process.env.CREW_HTTP_URL = "  ";
    expect(crewHttpUrl()).toBeNull();
    if (prev === undefined) delete process.env.CREW_HTTP_URL;
    else process.env.CREW_HTTP_URL = prev;
  });

  it("strips a trailing slash", () => {
    const prev = process.env.CREW_HTTP_URL;
    process.env.CREW_HTTP_URL = "https://example.replit.app/";
    expect(crewHttpUrl()).toBe("https://example.replit.app");
    if (prev === undefined) delete process.env.CREW_HTTP_URL;
    else process.env.CREW_HTTP_URL = prev;
  });
});
