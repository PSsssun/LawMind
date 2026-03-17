# LawMind 工程记忆（规划与进度）

本文件是 **LawMind 工程实施记忆**，用于持续记录：

- 路线决策
- 当前阶段目标
- 已完成项
- 风险与阻塞
- 下一步动作

目标是避免后续开发“只记得局部，不记得全局”。

---

## 1) 北极星目标

在 OpenClaw 经验基础上，构建律师行业可落地的 LawMind：

- 默认可审计
- 默认可确认
- 默认可追责
- 默认可扩展

第一阶段聚焦最小闭环：`指令 -> 检索 -> 结构化草稿 -> 审核 -> Word 输出 -> 审计`

---

## 2) 当前里程碑（M1）

**里程碑名称**：最小闭环基础工程（M1）  
**状态**：进行中  
**开始时间**：2026-03-17

### M1 目标清单

- [x] 双记忆模板：`workspace/MEMORY.md`、`workspace/LAWYER_PROFILE.md`
- [x] 核心类型：`TaskIntent`、`ResearchBundle`、`ArtifactDraft`、`AuditEvent`
- [x] 五层骨架：Router / Memory / Retrieval / Artifacts / Audit
- [x] `docx` 依赖引入（Word 渲染）
- [~] 通用模型检索适配器接入（已支持 OpenAI-compatible，待绑定生产模型参数）
- [~] 法律模型检索适配器接入（已支持 OpenAI-compatible，待绑定生产模型参数）
- [x] Reasoning 层（bundle -> draft）串主入口
- [x] Word 模板目录与默认模板
- [x] 端到端 smoke 流程脚本
- [~] 人工审核交互（CLI 版已完成，待 UI 版）

---

## 3) 当前代码落地概览

### 已落地目录

- `src/lawmind/types.ts`
- `src/lawmind/router/index.ts`
- `src/lawmind/memory/index.ts`
- `src/lawmind/retrieval/index.ts`
- `src/lawmind/retrieval/model-adapters.ts`
- `src/lawmind/reasoning/index.ts`
- `src/lawmind/artifacts/render-docx.ts`
- `src/lawmind/audit/index.ts`
- `src/lawmind/index.ts`

### 已落地记忆文件

- `workspace/MEMORY.md`
- `workspace/LAWYER_PROFILE.md`
- `workspace/templates/word/*.md`
- `workspace/templates/ppt/client-brief-default.md`

---

## 4) 决策记录（短）

1. **架构路线**：独立核心 + 适配层，不做普通插件寄生。
2. **记忆策略**：Markdown 为真相源，结构化索引为派生层。
3. **安全策略**：高风险任务默认需要人工确认。
4. **交付策略**：先 Word 后 PPT，先可控再自动化。

---

## 5) 风险与阻塞

### 风险

- 通用模型与法律模型输出冲突时的合并策略仍需明确定义。
- 模板体系尚未规范版本管理（模板升级可能影响历史产物一致性）。
- 审核流程目前是接口约束，尚无交互界面。

### 阻塞

- 暂无硬阻塞。

---

## 6) 下一步（优先级）

1. 完成 Reasoning 层并接入引擎。
2. 把 OpenAI-compatible 适配器接入真实模型参数（baseUrl / key / model）。
3. 建立 `workspace/templates/word/` 默认模板。
4. 提供一个可运行的最小示例脚本（模拟律师确认流程）。
5. 在 `GOALS.md` 同步打勾当前已完成项。

---

## 7) 更新日志

### 2026-03-17

- 新建 LawMind 文档体系：愿景、决策、架构。
- 新建工程记忆文档（本文件）。
- 建立双记忆模板与 LawMind 代码骨架。
- 增加 Word 渲染能力并引入 `docx` 依赖。
- 新增 Reasoning 层并接入引擎 `draft()` 主流程。
- 新增模型检索适配器工厂（general / legal）。
- 新增 Word/PPT 默认模板目录与模板文件。
- 新增 `scripts/lawmind-smoke.ts`，跑通最小闭环并生成 Word 产物。
- 新增 OpenAI-compatible 检索适配器：`src/lawmind/retrieval/openai-compatible.ts`。
- smoke 脚本支持真实模型模式（环境变量）与 mock 模式自动切换。
- 新增 provider 预设：国内通用模型入口（Qwen/DeepSeek/GLM/Moonshot/SiliconFlow）。
- 新增法律专用适配入口：ChatLaw / LaWGPT / LexEdge / 合作方本地部署扩展位。
- 新增 CLI 审核交互模块：`src/lawmind/review/cli.ts`。
- 新增模型适配说明文档：`docs/LAWMIND-MODEL-ADAPTERS.md`。
- 新增环境模板：`.env.lawmind.example`，支持一键切换真实模型接入。
