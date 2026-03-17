/**
 * Instruction Router
 *
 * 负责把律师的自然语言指令映射为结构化 TaskIntent。
 * 职责边界：只做分类，不做执行。
 *
 * 扩展方式：
 *   在 TASK_KIND_PATTERNS 里增加新的关键字映射即可支持新任务类型，
 *   不需要修改 route() 主逻辑。
 */

import { randomUUID } from "node:crypto";
import type { TaskIntent, TaskKind, RiskLevel } from "../types.js";

// ─────────────────────────────────────────────
// 关键字 -> 任务类型映射
// ─────────────────────────────────────────────

const TASK_KIND_PATTERNS: Array<{ pattern: RegExp; kind: TaskKind }> = [
  { pattern: /合同|协议|条款|审查|review/i, kind: "analyze.contract" },
  { pattern: /法律意见|法规|法条|类案|裁判|司法解释/i, kind: "research.legal" },
  { pattern: /律师函|催款|通知函|警告信|demand/i, kind: "draft.word" },
  { pattern: /摘要|案情|案件概述|summarize/i, kind: "summarize.case" },
  { pattern: /汇报|PPT|幻灯片|演示|slides/i, kind: "draft.ppt" },
  { pattern: /检索|调研|整理|背景|研究/i, kind: "research.hybrid" },
  { pattern: /文件|文书|报告|word|docx/i, kind: "draft.word" },
];

// ─────────────────────────────────────────────
// 风险等级规则
// ─────────────────────────────────────────────

const HIGH_RISK_KINDS = new Set<TaskKind>(["draft.word", "draft.ppt"]);
const MEDIUM_RISK_KINDS = new Set<TaskKind>([
  "analyze.contract",
  "research.legal",
  "summarize.case",
]);

function inferRiskLevel(kind: TaskKind): RiskLevel {
  if (HIGH_RISK_KINDS.has(kind)) {
    return "high";
  }
  if (MEDIUM_RISK_KINDS.has(kind)) {
    return "medium";
  }
  return "low";
}

// ─────────────────────────────────────────────
// 模型路由规则
// ─────────────────────────────────────────────

type ModelRole = "general" | "legal";

function inferModels(kind: TaskKind): ModelRole[] {
  if (kind === "research.general") {
    return ["general"];
  }
  if (kind === "research.legal") {
    return ["legal"];
  }
  if (kind === "draft.ppt") {
    return ["general"];
  }
  // 默认同时用两个模型
  return ["general", "legal"];
}

// ─────────────────────────────────────────────
// 主路由函数
// ─────────────────────────────────────────────

export type RouteInput = {
  instruction: string;
  matterId?: string;
  templateId?: string;
  audience?: string;
};

/**
 * 将自然语言指令映射为 TaskIntent。
 *
 * 返回 TaskIntent 后，调用方应向律师展示 summary，
 * 确认后才能进入 Retrieval Layer。
 */
export function route(input: RouteInput): TaskIntent {
  const { instruction, matterId, templateId, audience } = input;

  const matched = TASK_KIND_PATTERNS.find((p) => p.pattern.test(instruction));
  const kind: TaskKind = matched?.kind ?? "unknown";
  const riskLevel = inferRiskLevel(kind);
  const models = inferModels(kind);

  // output 类型推断
  const output =
    kind === "draft.ppt"
      ? "pptx"
      : kind.startsWith("draft") || kind === "analyze.contract" || kind === "summarize.case"
        ? "docx"
        : "markdown";

  // 高风险任务必须经过律师确认
  const requiresConfirmation = riskLevel === "high" || kind === "unknown";

  const summary = buildSummary({ kind, instruction, output });

  return {
    taskId: randomUUID(),
    kind,
    output,
    summary,
    audience,
    matterId,
    templateId,
    riskLevel,
    models,
    requiresConfirmation,
    createdAt: new Date().toISOString(),
  };
}

function buildSummary(params: {
  kind: TaskKind;
  instruction: string;
  output: TaskIntent["output"];
}): string {
  const { kind, instruction, output } = params;
  const outputLabel =
    output === "docx" ? "Word 文书" : output === "pptx" ? "PPT 汇报" : "Markdown 草稿";
  const kindLabel: Record<TaskKind, string> = {
    "research.general": "通用检索整理",
    "research.legal": "法律专项检索",
    "research.hybrid": "联合检索整理",
    "draft.word": "生成" + outputLabel,
    "draft.ppt": "生成" + outputLabel,
    "summarize.case": "案件摘要",
    "analyze.contract": "合同审查",
    unknown: "任务类型未识别，需人工确认",
  };

  return `任务类型：${kindLabel[kind]}。原始指令：「${instruction.slice(0, 60)}${instruction.length > 60 ? "…" : ""}」`;
}
