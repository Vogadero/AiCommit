<p align="center">
  <img src="images/icon.png" alt="AI Commit" width="128" height="128">
</p>

<h1 align="center">AI Commit</h1>

<p align="center">
  <strong>Smart Git Commit Message Generator</strong>
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

## ✨ Features

- 🤖 **AI-Powered** — Automatically generate conventional commit messages from code diffs
- 🔌 **OpenAI Compatible** — Works with any OpenAI-compatible API (DeepSeek, Qwen, Moonshot, GLM, etc.)
- 🎨 **Multiple Styles** — Built-in Conventional Commits, Gitmoji, Bullet styles, and custom Prompt support
- 🔄 **Multiple Candidates** — Generate multiple candidates at once, pick your favorite via QuickPick
- ⚡ **Streaming Response** — SSE streaming output, first token in < 1 second
- 📊 **Usage Tracking** — Token usage tracking, cost calculation, budget alerts, 14-day trend chart
- 🔐 **Secure Storage** — API Keys stored in VSCode SecretStorage, Settings Sync compatible
- 🌐 **Proxy Support** — HTTP/HTTPS/SOCKS5 proxy with environment variable fallback
- 📁 **Project Config** — `.aicommitrc.json` for project-level configuration overrides
- 🏷️ **Model Groups** — Multiple AI configurations with one-click switching, status bar indicator
- 📜 **History** — Generation history with save, reuse, and export capabilities
- ✏️ **Amend Support** — Amend the last commit with AI-generated messages

## 📦 Installation

### VSCode Marketplace

*Coming soon*

### Manual Install

1. Download the `.vsix` file from [Releases](https://github.com/Vogadero/AiCommit/releases)
2. In VSCode, press `Ctrl+Shift+P` and run `Extensions: Install from VSIX...`
3. Select the downloaded `.vsix` file

## 🚀 Quick Start

1. **Configure API** — Open the Command Palette (`Ctrl+Shift+P`) and run `AI Commit: Open Configuration Panel`
   - Enter your API Key, Base URL, and model name
   - Or create model configuration groups for quick switching

2. **Generate Commit** — Click the ✨ icon in the Source Control panel, or run:
   - `AI Commit: Generate Commit Message` — Generate candidates
   - `AI Commit: Generate and Commit` — Generate and auto-commit

3. **Select & Commit** — Choose your preferred commit message from the QuickPick

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.apiKey` | API Key | - |
| `aicommit.model` | AI model name | `gpt-4` |
| `aicommit.baseUrl` | API base URL | `https://api.openai.com/v1` |
| `aicommit.temperature` | Generation temperature | `0.7` |
| `aicommit.maxTokens` | Max tokens | `500` |
| `aicommit.commitStyle` | Commit style | `conventional` |
| `aicommit.commitLanguage` | Commit language | `en` |
| `aicommit.enableStreaming` | Enable streaming response | `true` |
| `aicommit.proxy` | Proxy address | - |
| `aicommit.modelGroups` | Model configuration groups | `[]` |
| `aicommit.dailyBudget` | Daily budget | `0` |
| `aicommit.monthlyBudget` | Monthly budget | `0` |
| `aicommit.currency` | Currency | `USD` |

## 🎨 Commit Styles

| Style | Example |
|-------|---------|
| **Conventional** | `feat(auth): add login support` |
| **Gitmoji** | `✨ auth: add login support` |
| **Bullet** | `feat(auth): add login: - Implement JWT auth; - Add form validation.` |
| **Custom** | Custom Prompt template |

## 🌐 Supported AI Providers

| Provider | Base URL | Model Examples |
|----------|----------|----------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-coder` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo`, `qwen-plus`, `qwen-max` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4`, `glm-4-flash` |

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit

# Install dependencies
npm install

# Compile
npm run compile

# Build
npm run build

# Debug — Press F5 in VSCode to launch Extension Development Host
```

## 📄 License

[MIT License](./LICENSE)

Copyright (c) 2025 Vogadero

## 🤝 Contributing

Issues and Pull Requests are welcome!

- **Author**: Vogadero
- **Email**: 15732651140@163.com
- **GitHub**: [Vogadero/AiCommit](https://github.com/Vogadero/AiCommit)
