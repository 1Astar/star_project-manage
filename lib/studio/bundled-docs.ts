import canonicalRulesMd from "@/docs/ai/CANONICAL_RULES.md?raw";
import changelogMd from "@/CHANGELOG.md?raw";

export function getBundledCanonicalRules(): string {
  return canonicalRulesMd;
}

export function getBundledChangelog(): string {
  return changelogMd;
}
