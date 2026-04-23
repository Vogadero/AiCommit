<p align="center">
  <img src="images/icon.png" alt="AI Commit" width="128" height="128">
</p>

<h1 align="center">AI Commit</h1>

<p align="center">
  <strong>智能 Git Commit 信息生成器</strong>
</p>

<p align="center">
  <a href="./README.md">中文</a> | <a href="./README.en.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vscode-^1.97.0-blue" alt="VS Code">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/version-1.0.0-orange" alt="Version">
</p>

---

![](images/screenshot-config.png)

## ✨ 功能特性

### 🤖 AI 驱动生成
- 基于代码 `git diff` 自动分析变更内容，生成规范的 commit 信息
- 支持暂存区（`git diff --cached`）和工作区（`git diff`）两种 diff 来源
- 一次生成多条候选方案（1-5 条），QuickPick 快速选择最合适的一条
- 大 diff 自动截断，提供"继续生成 / 仅分析部分文件 / 取消"三选项
- 自动检测变更范围（scope），基于受影响模块智能推断
- 项目上下文增强，附加项目名称和最近提交记录提升生成质量

### 🔌 OpenAI 兼容协议
- 兼容所有 OpenAI API 协议的服务商，即配即用
- 支持 API Key 环境变量引用（`${env:API_KEY_NAME}`）
- 连接测试功能，一键验证 API 配置是否正确
- 模型列表自动获取，从 API 拉取可用模型

### 🎨 多种提交风格
- **Conventional Commits** — `feat(auth): add login support`
- **Gitmoji** — `✨ auth: add login support`
- **Bullet** — `feat(auth): 添加登录功能: - 实现 JWT 认证; - 添加表单验证。`
- **Custom** — 自定义格式模板，完全控制输出格式

### 📝 7 种 Prompt 模板
- **Bullet**（默认）— AI Commit 内置风格，标题末尾冒号，正文每行一个变更点
- **Conventional Expert** — 标准 Conventional Commits 格式
- **Concise** — 简洁风格，只生成标题行和简短正文
- **Detailed** — 详细风格，包含动机、实现方式、风险评估
- **Semantic** — 语义化风格，使用结构化 XML 格式分析变更
- **Team** — 团队协作风格，支持破坏性变更标记和 Issue 关联
- **Custom** — 自定义 Prompt 模板，支持占位符替换

### ⚡ 流式响应
- SSE 流式输出，首字显示时间 < 1 秒
- 请求发送 `stream: true` 参数，实时解析 SSE 事件流
- 支持 `stream_options.include_usage` 获取精确 Token 用量
- 可通过 `enableStreaming` 配置关闭，兼容不支持 SSE 的私有部署

### 🏷️ 模型配置组
- 创建多组 AI 配置（如 GPT-4o、DeepSeek、公司私有部署）
- 每组独立配置：模型、API Key、Base URL、温度、Max Tokens
- API Key 加密存储在 VSCode SecretStorage，安全可靠
- 一键切换配置组，状态栏实时显示当前组名
- 支持配置组的添加、编辑、删除操作

### 📊 用量统计
- 今日 / 本周 / 本月 Token 用量与费用实时统计
- 近 14 天用量趋势图，柱状图 + 费用折线叠加展示
- 日均用量、总调用次数、日均费用概览
- 日预算 / 月预算告警（80% 警告、100% 超限）
- 多币种支持（USD / CNY），可自定义汇率
- 自定义模型单价，覆盖内置单价表
- 用量数据导出为 JSON 或 CSV 格式

### 🔐 密钥安全
- API Key 存储在 VSCode SecretStorage，不写入 settings.json
- 支持 Settings Sync，密钥为空时自动提示重新输入
- 配置组 API Key 独立管理，重命名时自动迁移

### 🌐 代理支持
- **HTTP/HTTPS 代理** — `http://proxy.example.com:8080`
- **SOCKS5 代理** — `socks5://proxy.example.com:1080`（原生实现，无需额外依赖）
- 代理认证支持 — `http://user:password@proxy:8080`
- 环境变量自动回退 — `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`

### 📁 项目级配置
- `.aicommitrc.json` 项目级配置文件，覆盖用户级设置
- 支持覆盖模型、温度、Max Tokens、提交风格等参数
- 文件监听与自动重载，修改即时生效
- `.aicommitignore` 文件过滤，排除不需要分析的文件

### 📜 历史记录
- 自动保存每次生成的 commit 信息
- 历史列表查看与复用，QuickPick 快速选择
- 支持清空历史和导出诊断日志
- 数据保留 90 天后自动清理

### ✏️ 其他功能
- **Amend 提交** — 对上次提交进行 amend 修改
- **取消生成** — 生成过程中随时取消
- **重新生成** — 对上次结果不满意，一键重新生成
- **多工作区支持** — 多根工作区下自动识别目标仓库
- **AI 响应后处理管线** — 6 步清理管线，确保输出规范
- **标题行长度限制** — 可配置标题行最大字符数（默认 72）

## 📦 安装

### VSCode Marketplace

*即将发布*

### 手动安装

1. 从 [Releases](https://github.com/Vogadero/AiCommit/releases) 下载 `.vsix` 文件
2. 在 VSCode 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX...`
3. 选择下载的 `.vsix` 文件

### 从源码构建

```bash
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit
npm install
npm run build
npx vsce package
# 生成 aicommit-1.0.0.vsix，然后手动安装
```

## 🚀 快速开始

### 1. 配置 API

打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`），执行 `AI Commit: 打开配置面板`：

- **API Key** — 输入你的 AI 服务商密钥
- **Base URL** — 填入 API 地址（默认 OpenAI）
- **模型名称** — 如 `gpt-4o`、`deepseek-chat` 等
- 点击"测试连接"验证配置

或者创建**模型配置组**，一键切换不同服务商。

### 2. 生成 Commit

在源代码管理面板（`Ctrl+Shift+G`）：

- 点击 ✨ 图标生成 commit 信息
- 或点击 ✓ 图标生成并直接提交
- 也可使用命令面板执行 `AI Commit: 生成 Commit 信息`

### 3. 选择提交

从 QuickPick 中选择满意的 commit 信息，自动填入提交框。

### 4. 自定义风格

在配置面板中选择提交风格，或编写自定义 Prompt 模板完全控制输出格式。

## ⚙️ 配置项

### 基础配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.enabled` | 启用或禁用 AI Commit 插件 | `true` |
| `aicommit.baseUrl` | API 基础 URL（需兼容 OpenAI 协议） | `https://api.openai.com/v1` |
| `aicommit.apiKey` | API 密钥（⚠️ 已弃用，请通过配置面板管理） | - |
| `aicommit.model` | AI 模型名称 | `gpt-4` |
| `aicommit.temperature` | 生成温度（0-2），值越低越确定 | `0.7` |
| `aicommit.maxTokens` | 最大生成 Tokens | `500` |

### 提交配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.format` | 提交风格：`conventional` / `gitmoji` / `bullet` / `custom` | `bullet` |
| `aicommit.customFormatTemplate` | 自定义格式模板（format 为 custom 时生效） | `<type>(<scope>): <description>` |
| `aicommit.commitLanguage` | 提交语言：`English` / `Chinese` / `Follow VSCode` | `English` |
| `aicommit.diffSource` | Diff 来源：`staged` / `unstaged` | `staged` |
| `aicommit.maxLength` | 标题行最大字符数 | `72` |
| `aicommit.candidateCount` | 候选方案数量（1-5） | `2` |
| `aicommit.autoDetectScope` | 自动检测变更范围（scope） | `true` |
| `aicommit.diffTruncateThreshold` | Diff 截断阈值（行数） | `3000` |

### Prompt 模板

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.promptTemplate` | Prompt 模板：`bullet` / `conventional-expert` / `concise` / `detailed` / `semantic` / `team` / `custom` | `bullet` |
| `aicommit.customPromptTemplate` | 自定义 Prompt 模板内容（promptTemplate 为 custom 时生效） | - |

### 模型配置组

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.modelGroups` | 模型配置组列表 | `[]` |
| `aicommit.activeModelGroup` | 当前活跃配置组名称 | - |

### 网络配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.enableStreaming` | 启用 SSE 流式响应 | `true` |
| `aicommit.proxy` | 代理地址（HTTP/HTTPS/SOCKS5） | - |

### 用量与预算

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.dailyBudget` | 日预算（0 为不限制） | `0` |
| `aicommit.monthlyBudget` | 月预算（0 为不限制） | `0` |
| `aicommit.currency` | 货币单位：`USD` / `CNY` | `USD` |
| `aicommit.exchangeRate` | 自定义汇率（1 USD = ? CNY） | `7.2` |
| `aicommit.customModelPricing` | 自定义模型单价（覆盖内置单价表） | `{}` |

### 状态栏配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.showStatusBarConfig` | 显示配置面板入口（齿轮图标） | `true` |
| `aicommit.showStatusBarGroup` | 显示当前配置组名称 | `true` |
| `aicommit.showStatusBarGenerate` | 显示生成入口（sparkle 图标） | `true` |

### 其他配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.saveHistory` | 保存 AI 生成历史记录 | `false` |
| `aicommit.logLevel` | 日志级别：`error` / `warn` / `info` / `debug` | `info` |
| `aicommit.enableProjectContext` | 启用项目上下文增强 | `false` |

## 🎨 提交风格详解

### Conventional Commits
```
feat(auth): add JWT-based user login
fix(api): handle null response from server
docs: update API documentation
refactor(utils): extract helper functions
```

### Gitmoji
```
✨ auth: add JWT-based user login
🐛 api: handle null response from server
📝 docs: update API documentation
♻️ utils: extract helper functions
```

### Bullet
```
feat(auth): 添加用户登录功能:
- 实现基于 JWT 的用户登录认证;
- 添加登录表单验证与 Token 刷新机制;
- 集成 OAuth 第三方登录并持久化登录状态。
```

### Custom
使用自定义 Prompt 模板，完全控制输出格式和内容。支持变量替换和条件逻辑。

## 🌐 支持的 AI 服务商

| 服务商 | Base URL | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-coder` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo`, `qwen-plus`, `qwen-max` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4`, `glm-4-flash` |

> 💡 任何兼容 OpenAI API 协议的服务均可使用，只需填入对应的 Base URL 和模型名称。

## 📋 命令列表

| 命令 | 说明 |
|------|------|
| `AI Commit: 生成 Commit 信息` | 分析 diff 并生成候选 commit 信息 |
| `AI Commit: 生成并提交` | 生成后自动提交 |
| `AI Commit: 重新生成` | 重新生成候选方案 |
| `AI Commit: 取消生成` | 取消正在进行的生成 |
| `AI Commit: 测试连接` | 测试 API 连接是否正常 |
| `AI Commit: 选择 AI 模型` | 从 API 获取可用模型列表 |
| `AI Commit: 打开配置面板` | 打开可视化配置面板 |
| `AI Commit: 切换模型配置组` | QuickPick 切换配置组 |
| `AI Commit: 使用历史记录` | 查看并复用生成历史 |
| `AI Commit: 清空生成历史` | 清空所有历史记录 |
| `AI Commit: 导出用量数据` | 导出 Token 用量统计 |
| `AI Commit: 导出诊断日志` | 导出诊断信息用于问题排查 |
| `AI Commit: 修改上次提交信息` | 对上次提交进行 amend 修改 |

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit

# 安装依赖
npm install

# 编译（TypeScript 类型检查）
npm run compile

# 构建（esbuild 打包）
npm run build

# 监听模式（开发时自动重新编译）
npm run watch

# 打包 vsix
npx vsce package

# 调试 — 在 VSCode 中按 F5 启动扩展开发宿主
```

### 项目结构

```
src/
├── ai/                    # AI 服务相关
│   ├── aiService.ts       # AI 请求与响应处理（含 SSE、代理）
│   ├── promptBuilder.ts    # Prompt 构建器
│   ├── promptTemplates.ts  # 内置 Prompt 模板
│   ├── responsePipeline.ts # 响应后处理管线
│   └── tokenTracker.ts     # Token 用量追踪
├── config/                # 配置管理
│   ├── configManager.ts    # 配置管理器（含模型组、SecretStorage）
│   ├── historyManager.ts   # 生成历史管理
│   └── projectConfig.ts    # 项目级配置加载
├── git/                   # Git 操作
│   └── gitService.ts       # Git 服务（diff 获取、提交）
├── ui/                    # 用户界面
│   ├── commandManager.ts   # 命令管理器
│   ├── configWebview.ts    # 配置面板 Webview
│   ├── scmButton.ts        # 源代码管理按钮
│   └── statusBar.ts        # 状态栏
└── utils/                 # 工具函数
    ├── diffTruncator.ts    # Diff 截断处理
    ├── errors.ts           # 错误码与自定义错误
    ├── ignoreFile.ts       # .aicommitignore 处理
    └── logger.ts           # 日志工具
```

## 📄 许可证

[MIT License](./LICENSE)

Copyright (c) 2025 Vogadero

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

- **作者**: Vogadero
- **邮箱**: 15732651140@163.com
- **GitHub**: [Vogadero/AiCommit](https://github.com/Vogadero/AiCommit)
