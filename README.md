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

## ✨ 功能特性

- 🤖 **AI 驱动** — 基于代码 diff 自动生成规范的 commit 信息
- 🔌 **OpenAI 兼容** — 支持所有 OpenAI 兼容 API（DeepSeek、通义千问、Moonshot、智谱 AI 等）
- 🎨 **多种提交风格** — 内置 Conventional Commits、Gitmoji、Bullet 等风格，支持自定义 Prompt
- 🔄 **多候选方案** — 一次生成多条候选，QuickPick 快速选择
- ⚡ **流式响应** — SSE 流式输出，首字显示 < 1 秒
- 📊 **用量统计** — Token 用量追踪、费用计算、预算告警、14 天趋势图
- 🔐 **密钥安全** — API Key 存储在 VSCode SecretStorage，支持 Settings Sync
- 🌐 **代理支持** — HTTP/HTTPS/SOCKS5 代理，环境变量自动回退
- 📁 **项目级配置** — `.aicommitrc.json` 项目级覆盖用户级配置
- 🏷️ **模型配置组** — 多组 AI 配置一键切换，状态栏显示当前组名
- 📜 **历史记录** — 生成历史保存与复用，支持清空和导出
- ✏️ **Amend 支持** — 对上次提交进行 amend 修改

## 📦 安装

### VSCode Marketplace

*即将发布*

### 手动安装

1. 从 [Releases](https://github.com/Vogadero/AiCommit/releases) 下载 `.vsix` 文件
2. 在 VSCode 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX...`
3. 选择下载的 `.vsix` 文件

## 🚀 快速开始

1. **配置 API** — 打开命令面板 (`Ctrl+Shift+P`)，执行 `AI Commit: 打开配置面板`
   - 填入 API Key、Base URL 和模型名称
   - 或创建模型配置组快速切换

2. **生成 Commit** — 在源代码管理面板点击 ✨ 图标，或执行命令：
   - `AI Commit: 生成 Commit 信息` — 生成候选方案
   - `AI Commit: 生成并提交` — 生成后自动提交

3. **选择提交** — 从 QuickPick 中选择满意的 commit 信息

## ⚙️ 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `aicommit.apiKey` | API 密钥 | - |
| `aicommit.model` | AI 模型名称 | `gpt-4` |
| `aicommit.baseUrl` | API 基础 URL | `https://api.openai.com/v1` |
| `aicommit.temperature` | 生成温度 | `0.7` |
| `aicommit.maxTokens` | 最大 Tokens | `500` |
| `aicommit.commitStyle` | 提交风格 | `conventional` |
| `aicommit.commitLanguage` | 提交语言 | `en` |
| `aicommit.enableStreaming` | 启用流式响应 | `true` |
| `aicommit.proxy` | 代理地址 | - |
| `aicommit.modelGroups` | 模型配置组 | `[]` |
| `aicommit.dailyBudget` | 日预算 | `0` |
| `aicommit.monthlyBudget` | 月预算 | `0` |
| `aicommit.currency` | 货币单位 | `USD` |

## 🎨 提交风格

| 风格 | 示例 |
|------|------|
| **Conventional** | `feat(auth): add login support` |
| **Gitmoji** | `✨ auth: add login support` |
| **Bullet** | `feat(auth): 添加登录功能: - 实现 JWT 认证; - 添加表单验证。` |
| **Custom** | 自定义 Prompt 模板 |

## 🌐 支持的 AI 服务商

| 服务商 | Base URL | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-coder` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo`, `qwen-plus`, `qwen-max` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | `glm-4`, `glm-4-flash` |

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit

# 安装依赖
npm install

# 编译
npm run compile

# 构建
npm run build

# 调试 — 在 VSCode 中按 F5 启动扩展开发宿主
```

## 📄 许可证

[MIT License](./LICENSE)

Copyright (c) 2025 Vogadero

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

- **作者**: Vogadero
- **邮箱**: 15732651140@163.com
- **GitHub**: [Vogadero/AiCommit](https://github.com/Vogadero/AiCommit)
