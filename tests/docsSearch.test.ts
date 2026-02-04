import { describe, expect, it } from "vitest";
import { searchLocalDocs } from "../lib/mastra/docs";

describe("docs search", () => {
  it("returns results for Memoraiz query", async () => {
    const results = await searchLocalDocs("Memoraiz", 3);
    expect(results.length).toBeGreaterThan(0);
  });
});
