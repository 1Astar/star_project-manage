"use server";

import { assertNotViewerWrite } from "@/lib/auth/require-admin";
import {
  generateInvestigationTasks,
  type GenerateInvestigationInput,
} from "@/lib/modules/generate-investigation-tasks";
import type { OpenAiCredentials } from "@/lib/studio/ai/openai-client";

export async function generateInvestigationTasksAction(input: {
  pageTitle: string;
  moduleName?: string;
  featureGoal?: string;
  pageDescription: string;
  observedFeatures?: string;
  observedAnomalies?: string;
  currentBody: string;
  revisionNote?: string;
  mode: "generate" | "regenerate";
  credentials?: OpenAiCredentials | null;
}) {
  assertNotViewerWrite();
  const { serverOpenAiCredentials } = await import(
    "@/lib/studio/ai/openai-server-settings"
  );
  const server = await serverOpenAiCredentials();
  const credentials =
    input.credentials?.apiKey?.trim() ? input.credentials : server;

  const payload: GenerateInvestigationInput = {
    pageTitle: input.pageTitle,
    moduleName: input.moduleName,
    featureGoal: input.featureGoal,
    pageDescription: input.pageDescription,
    observedFeatures: input.observedFeatures,
    observedAnomalies: input.observedAnomalies,
    currentBody: input.currentBody,
    revisionNote: input.revisionNote,
    mode: input.mode,
  };

  return generateInvestigationTasks(payload, credentials);
}
