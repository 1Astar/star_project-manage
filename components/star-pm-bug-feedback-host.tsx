import { BugFeedbackMount } from "@/components/bug-feedback-mount";
import { getProjectFeedbackToken } from "@/lib/bugs/feedback-token";
import { APP_VERSION } from "@/lib/app-meta";

/** Star PM 站内反馈钮：优先环境变量，否则用设置页已生成的 token */
export async function StarPmBugFeedbackHost() {
  const fromEnv =
    process.env.NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN?.trim() ||
    process.env.STAR_PM_FEEDBACK_TOKEN?.trim() ||
    "";
  const token = fromEnv || (await getProjectFeedbackToken("proj-star-pm"));
  if (!token) return null;
  return <BugFeedbackMount token={token} version={APP_VERSION} />;
}
