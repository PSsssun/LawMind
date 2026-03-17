import path from "node:path";
import {
  createLawMindEngine,
  createGeneralModelAdapter,
  createLegalModelAdapter,
  createOpenSourceLegalAdaptersFromEnv,
  createLexEdgeAdapterFromEnv,
  createDomesticGeneralAdaptersFromEnv,
  createPartnerLegalAdapterFromEnv,
  createWorkspaceAdapter,
} from "../src/lawmind/index.js";
import { reviewDraftInCli } from "../src/lawmind/review/cli.js";

async function main() {
  const workspaceDir = path.resolve(process.cwd(), "workspace");
  const interactiveReview =
    (process.env.LAWMIND_INTERACTIVE_REVIEW ?? "").trim().toLowerCase() === "1";

  const mockGeneralAdapter = createGeneralModelAdapter(async () => ({
    claims: [
      {
        text: "该事项需要先完成事实清单与证据清单，再形成正式法律意见。",
        confidence: 0.82,
      },
    ],
    sources: [{ title: "内部工作流规范", citation: "workspace/MEMORY.md" }],
  }));

  const mockLegalAdapter = createLegalModelAdapter(async () => ({
    claims: [
      {
        text: "在作出最终法律意见前，应明确适用法律条款并核对最新修订版本。",
        confidence: 0.9,
      },
    ],
    sources: [{ title: "法律检索规则", citation: "通用法律工作流规则" }],
    riskFlags: ["当前为 smoke 数据，需替换为真实检索来源。"],
  }));

  const realAdapters = [
    ...createDomesticGeneralAdaptersFromEnv(),
    ...createOpenSourceLegalAdaptersFromEnv(),
    ...createLexEdgeAdapterFromEnv(),
    ...createPartnerLegalAdapterFromEnv(),
  ];
  const useRealModel = realAdapters.length > 0;
  const modelAdapters = useRealModel ? realAdapters : [mockGeneralAdapter, mockLegalAdapter];

  const engine = createLawMindEngine({
    workspaceDir,
    adapters: [createWorkspaceAdapter(workspaceDir), ...modelAdapters],
  });

  const intent = engine.plan("请整理合同审查意见并生成律师函草稿", {
    audience: "客户",
    templateId: "word/demand-letter-default",
  });

  const bundle = await engine.research(intent);
  const draft = engine.draft(intent, bundle, { title: "LawMind Smoke 律师函草稿" });

  if (interactiveReview) {
    const reviewed = await reviewDraftInCli(draft);
    if (!reviewed.ok) {
      throw new Error(`草稿未通过审核: ${reviewed.reason}`);
    }
  } else {
    // smoke 流程默认自动通过
    draft.reviewStatus = "approved";
    draft.reviewedBy = "lawyer:smoke";
    draft.reviewedAt = new Date().toISOString();
  }

  const rendered = await engine.render(draft);
  if (!rendered.ok) {
    throw new Error(rendered.error ?? "LawMind smoke failed.");
  }

  console.log("[LawMind] Smoke success.");
  console.log(`mode=${useRealModel ? "real-model" : "mock-model"}`);
  console.log(`review=${interactiveReview ? "interactive" : "auto-smoke"}`);
  console.log(`intent: ${intent.kind}, risk=${intent.riskLevel}`);
  console.log(`sources=${bundle.sources.length}, claims=${bundle.claims.length}`);
  console.log(`output=${rendered.outputPath}`);
}

main().catch((err) => {
  console.error("[LawMind] Smoke failed:", err);
  process.exitCode = 1;
});
