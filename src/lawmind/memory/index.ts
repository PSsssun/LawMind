/**
 * Memory Layer
 *
 * 负责在任务启动时加载双记忆文档，并提供写入接口。
 *
 * 读取顺序（固定）：
 *   1. MEMORY.md        — 通用长期记忆
 *   2. LAWYER_PROFILE.md — 律师个人偏好
 *   3. memory/YYYY-MM-DD.md（今天）— 日志
 *   4. memory/YYYY-MM-DD.md（昨天）— 日志
 *
 * 第二阶段：增加 cases/<matterId>/CASE.md 的按需读取。
 */

import fs from "node:fs/promises";
import path from "node:path";

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

export type MemoryContext = {
  /** MEMORY.md 内容 */
  general: string;
  /** LAWYER_PROFILE.md 内容 */
  profile: string;
  /** 今天的日志 */
  todayLog: string;
  /** 昨天的日志 */
  yesterdayLog: string;
};

// ─────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────

async function readSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    // 文件不存在时静默返回空串，上游可以判断
    return "";
  }
}

function dailyLogPath(workspaceDir: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(workspaceDir, "memory", `${yyyy}-${mm}-${dd}.md`);
}

// ─────────────────────────────────────────────
// 加载双记忆
// ─────────────────────────────────────────────

/**
 * 加载任务所需的记忆上下文。
 * 每次任务启动时调用一次，结果传入 Retrieval 和 Reasoning 层。
 */
export async function loadMemoryContext(workspaceDir: string): Promise<MemoryContext> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const [general, profile, todayLog, yesterdayLog] = await Promise.all([
    readSafe(path.join(workspaceDir, "MEMORY.md")),
    readSafe(path.join(workspaceDir, "LAWYER_PROFILE.md")),
    readSafe(dailyLogPath(workspaceDir, today)),
    readSafe(dailyLogPath(workspaceDir, yesterday)),
  ]);

  return { general, profile, todayLog, yesterdayLog };
}

// ─────────────────────────────────────────────
// 写入日志（追加到今天的日志文件）
// ─────────────────────────────────────────────

/**
 * 向今天的日志文件追加一条记录。
 * 用于记录任务进展、决策、审核结果等。
 */
export async function appendTodayLog(workspaceDir: string, entry: string): Promise<void> {
  const logPath = dailyLogPath(workspaceDir, new Date());
  await fs.mkdir(path.dirname(logPath), { recursive: true });

  const timestamp = new Date().toISOString();
  const line = `\n<!-- ${timestamp} -->\n${entry}\n`;
  await fs.appendFile(logPath, line, "utf8");
}

// ─────────────────────────────────────────────
// 更新律师偏好（追加到 LAWYER_PROFILE.md 第八节）
// ─────────────────────────────────────────────

/**
 * 将新偏好追加到 LAWYER_PROFILE.md 的"个人积累"节。
 * 只追加，不改写现有内容。
 */
export async function appendLawyerProfile(workspaceDir: string, note: string): Promise<void> {
  const profilePath = path.join(workspaceDir, "LAWYER_PROFILE.md");
  const timestamp = new Date().toISOString().slice(0, 10);
  const entry = `\n- [${timestamp}] ${note}`;
  await fs.appendFile(profilePath, entry, "utf8");
}
