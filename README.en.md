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

### 🤖 AI-Powered Generation
- Automatically analyze code changes from `git diff` to generate conventional commit messages
- Support both staged (`git diff --cached`) and unstaged (`git diff`) diff sources
- Generate multiple candidates (1-5) at once, pick your favorite via QuickPick
- Auto-truncate large diffs with "Continue / Partial analysis / Cancel" options
- Auto-detect change scope based on affected modules
- Project context enhancement with project name and recent commit history

### 🔌 OpenAI Compatible
- Works with any OpenAI API-compatible provider — configure and go
- API Key environment variable support (`${env:API_KEY_NAME}`)
- Connection test feature — verify your API configuration with one click
- Auto-fetch available models from the API

### 🎨 Multiple Commit Styles
- **Conventional Commits** — `feat(auth): add login support`
- **Gitmoji** — `✨ auth: add login support`
- **Bullet** — `feat(auth): add login: - Implement JWT auth; - Add form validation.`
- **Custom** — Custom format template for full control over output format

### 📝 7 Prompt Templates
- **Bullet** (default) — AI Commit built-in style, colon at title end, bullet-point body
- **Conventional Expert** — Standard Conventional Commits format
- **Concise** — Minimal style, title line and short body only
- **Detailed** — Verbose style with motivation, implementation, and risk assessment
- **Semantic** — Structured XML format for change analysis
- **Team** — Team collaboration style with breaking change markers and Issue linking
- **Custom** — Custom Prompt template with placeholder substitution

### ⚡ Streaming Response
- SSE streaming output, first token in < 1 second
- Sends `stream: true` parameter, parses SSE event stream in real time
- Supports `stream_options.include_usage` for accurate token usage data
- Can be disabled via `enableStreaming` config for private deployments without SSE support

### 🏷️ Model Configuration Groups
- Create multiple AI configurations (e.g., GPT-4o, DeepSeek, company private deployment)
- Each group has independent settings: model, API Key, Base URL, temperature, Max Tokens
- API Keys encrypted and stored in VSCode SecretStorage
- One-click group switching with real-time status bar indicator
- Full CRUD support: add, edit, and delete configuration groups

### 📊 Usage Statistics
- Today / This Week / This Month token usage and cost tracking
- 14-day usage trend chart with bar chart + cost line overlay
- Daily average usage, total call count, and daily average cost overview
- Daily / Monthly budget alerts (80% warning, 100% exceeded)
- Multi-currency support (USD / CNY) with customizable exchange rate
- Custom model pricing to override built-in price table
- Export usage data as JSON or CSV

### 🔐 Secure Key Storage
- API Keys stored in VSCode SecretStorage, never written to settings.json
- Settings Sync compatible — auto-prompts for re-entry when key is empty
- Independent API Key management per configuration group, auto-migration on rename

### 🌐 Proxy Support
- **HTTP/HTTPS Proxy** — `http://proxy.example.com:8080`
- **SOCKS5 Proxy** — `socks5://proxy.example.com:1080` (native implementation, no extra dependencies)
- Proxy authentication — `http://user:password@proxy:8080`
- Environment variable fallback — `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`

### 📁 Project-Level Configuration
- `.aicommitrc.json` project config file overrides user-level settings
- Override model, temperature, Max Tokens, commit style, and more
- File watching with auto-reload — changes take effect immediately
- `.aicommitignore` file filtering to exclude files from analysis

### 📜 History
- Auto-save every generated commit message
- View and reuse history entries via QuickPick
- Clear history and export diagnostic logs
- Data auto-cleanup after 90 days

### ✏️ More Features
- **Amend Commit** — Amend the last commit with AI-generated messages
- **Cancel Generation** — Cancel at any time during generation
- **Regenerate** — Not satisfied? One-click regenerate
- **Multi-Workspace** — Auto-detect target repository in multi-root workspaces
- **AI Response Pipeline** — 6-step cleanup pipeline ensuring clean output
- **Title Length Limit** — Configurable max title line length (default 72)

## 📦 Installation

### VSCode Marketplace

*Coming soon*

### Manual Install

1. Download the `.vsix` file from [Releases](https://github.com/Vogadero/AiCommit/releases)
2. In VSCode, press `Ctrl+Shift+P` and run `Extensions: Install from VSIX...`
3. Select the downloaded `.vsix` file

### Build from Source

```bash
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit
npm install
npm run build
npx vsce package
# Generates aicommit-1.0.0.vsix, then install manually
```

## 🚀 Quick Start

### 1. Configure API

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run `AI Commit: Open Configuration Panel`:

- **API Key** — Enter your AI provider's key
- **Base URL** — Enter the API address (default: OpenAI)
- **Model Name** — e.g., `gpt-4o`, `deepseek-chat`, etc.
- Click "Test Connection" to verify

Or create **Model Configuration Groups** for quick provider switching.

### 2. Generate Commit

In the Source Control panel (`Ctrl+Shift+G`):

- Click the ✨ icon to generate commit messages
- Or click the ✓ icon to generate and commit directly
- You can also use `AI Commit: Generate Commit Message` from the Command Palette

### 3. Select & Commit

Choose your preferred commit message from the QuickPick — it auto-fills the commit input box.

### 4. Customize Style

Select a commit style in the configuration panel, or write a custom Prompt template for full control.

## ⚙️ Configuration

### Basic Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.enabled` | Enable or disable AI Commit extension | `true` |
| `aicommit.baseUrl` | API base URL (OpenAI-compatible) | `https://api.openai.com/v1` |
| `aicommit.apiKey` | API Key (⚠️ deprecated, use config panel) | - |
| `aicommit.model` | AI model name | `gpt-4` |
| `aicommit.temperature` | Generation temperature (0-2), lower = more deterministic | `0.7` |
| `aicommit.maxTokens` | Max generation tokens | `500` |

### Commit Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.format` | Commit style: `conventional` / `gitmoji` / `bullet` / `custom` | `bullet` |
| `aicommit.customFormatTemplate` | Custom format template (when format is custom) | `<type>(<scope>): <description>` |
| `aicommit.commitLanguage` | Commit language: `English` / `Chinese` / `Follow VSCode` | `English` |
| `aicommit.diffSource` | Diff source: `staged` / `unstaged` | `staged` |
| `aicommit.maxLength` | Max title line character count | `72` |
| `aicommit.candidateCount` | Number of candidates (1-5) | `2` |
| `aicommit.autoDetectScope` | Auto-detect change scope | `true` |
| `aicommit.diffTruncateThreshold` | Diff truncation threshold (lines) | `3000` |

### Prompt Templates

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.promptTemplate` | Prompt template: `bullet` / `conventional-expert` / `concise` / `detailed` / `semantic` / `team` / `custom` | `bullet` |
| `aicommit.customPromptTemplate` | Custom prompt template content (when promptTemplate is custom) | - |

### Model Groups

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.modelGroups` | Model configuration groups | `[]` |
| `aicommit.activeModelGroup` | Active configuration group name | - |

### Network Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.enableStreaming` | Enable SSE streaming response | `true` |
| `aicommit.proxy` | Proxy address (HTTP/HTTPS/SOCKS5) | - |

### Usage & Budget

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.dailyBudget` | Daily budget (0 = unlimited) | `0` |
| `aicommit.monthlyBudget` | Monthly budget (0 = unlimited) | `0` |
| `aicommit.currency` | Currency: `USD` / `CNY` | `USD` |
| `aicommit.exchangeRate` | Custom exchange rate (1 USD = ? CNY) | `7.2` |
| `aicommit.customModelPricing` | Custom model pricing (overrides built-in) | `{}` |

### Status Bar Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.showStatusBarConfig` | Show config panel entry (gear icon) | `true` |
| `aicommit.showStatusBarGroup` | Show current model group name | `true` |
| `aicommit.showStatusBarGenerate` | Show generate entry (sparkle icon) | `true` |

### Other Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `aicommit.saveHistory` | Save AI generation history | `false` |
| `aicommit.logLevel` | Log level: `error` / `warn` / `info` / `debug` | `info` |
| `aicommit.enableProjectContext` | Enable project context enhancement | `false` |

## 🎨 Commit Style Details

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
feat(auth): add user login:
- Implement JWT-based user authentication;
- Add form validation and token refresh;
- Integrate OAuth third-party login.
```

### Custom
Use custom Prompt templates for full control over output format and content. Supports variable substitution and conditional logic.

## 🌐 Supported AI Providers

| Provider | Base URL | Model Examples |
|----------|----------|----------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-coder` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo`, `qwen-plus`, `qwen-max` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4`, `glm-4-flash` |

> 💡 Any OpenAI API-compatible service works — just enter the corresponding Base URL and model name.

## 📋 Command List

| Command | Description |
|---------|-------------|
| `AI Commit: Generate Commit Message` | Analyze diff and generate candidate messages |
| `AI Commit: Generate and Commit` | Generate and auto-commit |
| `AI Commit: Regenerate` | Regenerate candidates |
| `AI Commit: Cancel Generation` | Cancel ongoing generation |
| `AI Commit: Test Connection` | Test API connectivity |
| `AI Commit: Select AI Model` | Fetch available models from API |
| `AI Commit: Open Configuration Panel` | Open visual config panel |
| `AI Commit: Switch Model Group` | QuickPick group switching |
| `AI Commit: Use History` | View and reuse generation history |
| `AI Commit: Clear History` | Clear all history |
| `AI Commit: Export Usage Data` | Export token usage statistics |
| `AI Commit: Export Diagnostic Log` | Export diagnostic info for troubleshooting |
| `AI Commit: Amend Commit` | Amend the last commit |

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/Vogadero/AiCommit.git
cd AiCommit

# Install dependencies
npm install

# Compile (TypeScript type checking)
npm run compile

# Build (esbuild bundling)
npm run build

# Watch mode (auto-recompile during development)
npm run watch

# Package vsix
npx vsce package

# Debug — Press F5 in VSCode to launch Extension Development Host
```

### Project Structure

```
src/
├── ai/                    # AI service
│   ├── aiService.ts       # AI request & response (SSE, proxy)
│   ├── promptBuilder.ts    # Prompt builder
│   ├── promptTemplates.ts  # Built-in Prompt templates
│   ├── responsePipeline.ts # Response post-processing pipeline
│   └── tokenTracker.ts     # Token usage tracking
├── config/                # Configuration management
│   ├── configManager.ts    # Config manager (model groups, SecretStorage)
│   ├── historyManager.ts   # Generation history
│   └── projectConfig.ts    # Project-level config loader
├── git/                   # Git operations
│   └── gitService.ts       # Git service (diff, commit)
├── ui/                    # User interface
│   ├── commandManager.ts   # Command manager
│   ├── configWebview.ts    # Configuration panel Webview
│   ├── scmButton.ts        # Source control buttons
│   └── statusBar.ts        # Status bar
└── utils/                 # Utilities
    ├── diffTruncator.ts    # Diff truncation
    ├── errors.ts           # Error codes & custom errors
    ├── ignoreFile.ts       # .aicommitignore handling
    └── logger.ts           # Logging utility
```

## 📄 License

[MIT License](./LICENSE)

Copyright (c) 2025 Vogadero

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push the branch: `git push origin feature/amazing-feature`
5. Submit a Pull Request

- **Author**: Vogadero
- **Email**: 15732651140@163.com
- **GitHub**: [Vogadero/AiCommit](https://github.com/Vogadero/AiCommit)
