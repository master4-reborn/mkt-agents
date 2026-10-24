import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY, or the `ant auth login` profile in local dev.
let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export const BETAS = ["managed-agents-2026-04-01"];
