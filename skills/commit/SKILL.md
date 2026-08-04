---
name: commit
description: "安全提交当前对话 Session 产生的改动，并在用户明确要求准备合并时维护仓库原生发布元数据。Use only when the user explicitly asks to commit current work, 提交一下, 提交这批改动, prepare a commit, 准备合并, or prepare a branch for PR in any language or ecosystem."
---

# Commit

把用户的明确提交请求视为本地 commit 授权，不重复要求确认。默认只提交当前 Session
的改动；仅在用户明确要求时扩大范围。

## 模式

- **提交**：“提交一下”“提交当前改动”只提交当前 Session，不生成发布元数据。
- **准备合并**：“准备合并”“整理后提 PR”检查完整分支 Diff，并按仓库原生机制
  幂等维护 Changeset、changelog fragment 或其他发布元数据；只有用户同时要求提交
  时才创建 commit。
- **明确范围**：用户指定路径、整个工作区或其他范围时，以该范围为准。

不要自行判断 WIP。普通提交与准备合并的区别来自用户请求，而不是 commit message、
文件数量或测试状态。

## 确定 Session 范围

以本次对话的工具记录、实际 patch 和直接生成文件为证据。仅因文件处于 dirty 状态，
不能认定它属于当前 Session。

- 默认排除用户原有改动、其他 Session、其他 Agent 和无关的 staged 文件；范围外
  staged 路径可被可靠保留时使用 path-limited commit，并在提交后复核其状态。
- 同一文件混有多方改动时，只暂存可验证属于当前 Session 的 hunk。
- 无法可靠拆分、发现疑似凭据或不能保证保留原暂存状态时停止并询问；不回显凭据，
  不擅自取消用户的暂存。
- 协调 Agent 独占发布元数据、暂存区和最终提交的写权限。

## 执行

1. 读取仓库指令、commit 规范、hooks、状态和相关 diff。提交信息遵循仓库格式与
   语言；没有约定时使用 Conventional Commits。
2. 准备合并时，比较开发基线后的完整分支结果，按独立用户结果归并发布意图；
   commit、文件、package 和 Agent 数量不是拆分单位。复用或更新等价片段，缺失时
   才按仓库格式创建；仓库没有片段机制时不引入新工具。
3. 在执行前简要说明将提交的路径、保留的 dirty 路径、commit message，以及准备
   合并时的发布元数据动作。范围清楚时直接继续，不等待第二次确认。
4. 仅按精确路径或可验证 hunk 暂存，复核 staged diff，运行仓库规定的快速相关校验，
   然后使用确认范围对应的 message 提交。
5. 不绕过 hooks。失败时保留现场并报告；不使用 `git add .`、`git add -A`、
   `git add -u` 或宽泛 glob。
6. 返回 commit hash、实际提交路径、校验结果和仍未提交的相关路径。

发布元数据的语言按“用户指定 → 仓库指令 → 现有元数据 → 当前对话语言”选择；
命令、标识符、package 名和版本号保持原样。

## 只在例外时确认

仅在范围或所有权不明确、同文件 hunk 无法拆分、疑似凭据、需要包含 Session 外改动，
或准备合并会产生 breaking/major 发布意图时请求确认。commit 不执行 push、tag、
publish、deploy 或外部通知。
