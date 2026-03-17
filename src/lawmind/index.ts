/**
 * LawMind 主入口 — 第一期最小闭环
 *
 * 链路：
 *   用户指令
 *     -> route()            Instruction Router
 *     -> [律师确认]          人工审核点 #1
 *     -> loadMemoryContext() Memory Layer
 *     -> retrieve()         Retrieval Layer
 *     -> [律师审核]          人工审核点 #2（高风险任务）
 *     -> renderDocx()        Artifact Layer
 *     -> emit(audit)         Audit Layer
 *
 * 使用方式：
 *   const engine = createLawMindEngine({ workspaceDir, outputDir, adapters });
 *   const intent = engine.plan("请整理XX合同审查意见并生成律师函");
 *   // 展示 intent.summary 给律师，等待确认
 *   const bundle = await engine.research(intent);
 *   // 展示 bundle 给律师，等待审核（高风险时）
 *   const draft = buildDraft(bundle, intent);
 *   // 展示 draft.sections 给律师，等待批准
 *   const result = await engine.render(draft);
 */

import path from "node:path";
import { renderDocx } from "./artifacts/render-docx.js";
import { emit } from "./audit/index.js";
import { loadMemoryContext, appendTodayLog } from "./memory/index.js";
import { buildDraft } from "./reasoning/index.js";
import { retrieve, type RetrievalAdapter } from "./retrieval/index.js";
import { route, type RouteInput } from "./router/index.js";
import type { TaskIntent, ResearchBundle, ArtifactDraft } from "./types.js";

// ─────────────────────────────────────────────
// 引擎配置
// ─────────────────────────────────────────────

export type LawMindEngineConfig = {
  /** 工作区根目录，内含 MEMORY.md / LAWYER_PROFILE.md / memory/ */
  workspaceDir: string;
  /** 最终产物输出目录（默认 workspaceDir/artifacts） */
  outputDir?: string;
  /** 检索适配器列表，按优先级排序 */
  adapters: RetrievalAdapter[];
};

// ─────────────────────────────────────────────
// 引擎
// ─────────────────────────────────────────────

export type LawMindEngine = {
  /** 步骤 1：解析指令，生成任务意图（供律师确认） */
  plan: (instruction: string, opts?: Omit<RouteInput, "instruction">) => TaskIntent;
  /** 步骤 2：执行检索（律师确认后调用） */
  research: (intent: TaskIntent) => Promise<ResearchBundle>;
  /** 步骤 3：生成草稿（供律师审核） */
  draft: (
    intent: TaskIntent,
    bundle: ResearchBundle,
    opts?: { title?: string; templateId?: string },
  ) => ArtifactDraft;
  /** 步骤 3：渲染文书（律师审核草稿后调用，draft.reviewStatus 须为 approved） */
  render: (draft: ArtifactDraft) => Promise<{ ok: boolean; outputPath?: string; error?: string }>;
};

export function createLawMindEngine(config: LawMindEngineConfig): LawMindEngine {
  const { workspaceDir, adapters } = config;
  const outputDir = config.outputDir ?? path.join(workspaceDir, "artifacts");
  const auditDir = path.join(workspaceDir, "audit");

  return {
    plan(instruction, opts = {}) {
      const intent = route({ instruction, ...opts });
      // 同步写日志（fire-and-forget，不阻塞返回）
      void appendTodayLog(
        workspaceDir,
        `## 任务计划\n- ID: ${intent.taskId}\n- 类型: ${intent.kind}\n- 摘要: ${intent.summary}`,
      );
      return intent;
    },

    async research(intent) {
      await emit(auditDir, {
        taskId: intent.taskId,
        kind: "research.started",
        actor: "system",
        detail: intent.summary,
      });

      const memory = await loadMemoryContext(workspaceDir);
      const bundle = await retrieve({ intent, memory, adapters });

      await emit(auditDir, {
        taskId: intent.taskId,
        kind: "research.completed",
        actor: "system",
        detail: `找到来源 ${bundle.sources.length} 条，结论 ${bundle.claims.length} 条，风险标记 ${bundle.riskFlags.length} 条`,
      });

      await appendTodayLog(
        workspaceDir,
        `## 检索完成\n- 来源：${bundle.sources.length}\n- 风险标记：${bundle.riskFlags.join("；") || "无"}`,
      );

      return bundle;
    },

    draft(intent, bundle, opts = {}) {
      const draft = buildDraft({
        intent,
        bundle,
        title: opts.title,
        templateId: opts.templateId,
      });
      void appendTodayLog(
        workspaceDir,
        `## 草稿生成\n- 模板: ${draft.templateId}\n- 输出: ${draft.output}`,
      );
      return draft;
    },

    async render(draft) {
      if (draft.reviewStatus !== "approved") {
        return {
          ok: false,
          error: `文书未通过审核（${draft.reviewStatus}），请律师先确认草稿。`,
        };
      }

      await emit(auditDir, {
        taskId: draft.taskId,
        kind: "artifact.rendered",
        actor: "system",
        detail: `模板：${draft.templateId}，格式：${draft.output}`,
      });

      const result = await renderDocx(draft, outputDir);

      if (result.ok && result.outputPath) {
        await emit(auditDir, {
          taskId: draft.taskId,
          kind: "artifact.rendered",
          actor: "system",
          detail: `输出路径：${result.outputPath}`,
        });
        await appendTodayLog(workspaceDir, `## 文书渲染完成\n- 路径: ${result.outputPath}`);
      }

      return result;
    },
  };
}

// 重导出核心类型，方便外部直接从入口引用
export type { TaskIntent, ResearchBundle, ArtifactDraft } from "./types.js";
export { route } from "./router/index.js";
export { loadMemoryContext } from "./memory/index.js";
export { createWorkspaceAdapter } from "./retrieval/index.js";
export { createGeneralModelAdapter, createLegalModelAdapter } from "./retrieval/model-adapters.js";
export { createOpenAICompatibleAdapters } from "./retrieval/openai-compatible.js";
export {
  createDomesticGeneralAdaptersFromEnv,
  createOpenSourceLegalAdaptersFromEnv,
  createLexEdgeAdapterFromEnv,
  createPartnerLegalAdapterFromEnv,
} from "./retrieval/providers.js";
export { readAuditLog } from "./audit/index.js";
