import { useState, useEffect, useRef } from 'react'
import './styles/global.css'

const featureDetailsZh: Record<string, { title: string; content: string }> = {
  ai: { title: 'AI 驱动生成', content: 'AI Commit 是一款基于 AI 大模型的 Git Commit 信息自动生成工具。它会读取你的代码变更（git diff），通过 AI 分析变更内容和意图，自动生成符合规范的 commit 信息。\n\n**什么是 git diff？**\ngit diff 是 Git 中查看代码变更的命令。当你修改了文件后，git diff 会显示你添加了哪些行（绿色 + 号）、删除了哪些行（红色 - 号）。AI Commit 就是读取这些变更信息来理解你做了什么修改。\n\n**两种 diff 来源：**\n- 暂存区 diff（默认）：`git diff --cached`，只分析你已经 git add 的文件\n- 工作区 diff：`git diff`，分析所有未暂存的修改\n\n通过 `aicommit.diffSource` 配置切换。如果你习惯先 add 再生成 commit，用默认的暂存区即可；如果你想先预览 commit 信息再决定 add 哪些文件，可以切换为工作区。\n\n**候选方案选择：**\nAI Commit 一次生成 1-5 条候选 commit 信息，通过 VSCode 的 QuickPick 弹出列表让你选择。你可以用 `aicommit.candidateCount` 配置生成数量。\n\n**大 diff 处理：**\n当变更行数超过 `aicommit.diffTruncateThreshold`（默认 3000 行）时，AI Commit 会弹出提示，提供三个选项：\n- 继续生成：发送完整 diff 给 AI\n- 仅分析部分文件：只分析前 N 个文件的变更\n- 取消：放弃本次生成\n\n**自动检测 scope：**\n开启 `aicommit.autoDetectScope`（默认开启）后，AI Commit 会根据变更涉及的目录和模块自动推断 scope。例如修改了 src/auth/ 目录下的文件，scope 会自动设为 auth。\n\n**项目上下文增强：**\n开启 `aicommit.enableProjectContext` 后，AI Commit 会附加项目名称和最近 5 条 commit 记录作为上下文，帮助 AI 更好地理解项目风格和变更意图。\n\n**使用示例：**\n```\n1. 修改代码后，在源代码管理面板点击 ✨ 图标\n2. 等待 AI 分析（流式响应约 1-3 秒）\n3. 从 QuickPick 列表选择最合适的 commit 信息\n4. 信息自动填入提交框，点击提交即可\n```\n\n**生成的 commit 信息示例：**\n```\nfeat(auth): 添加用户登录功能:\n- 实现 JWT 认证中间件;\n- 添加登录表单验证;\n- 集成 OAuth 第三方登录;\n- 持久化登录状态到 localStorage。\n```' },
  openai: { title: 'OpenAI 兼容', content: 'AI Commit 兼容所有遵循 OpenAI Chat Completions API 协议的 AI 服务商。这意味着你不必局限于 OpenAI，可以使用任何兼容的 API 服务，包括国内的 DeepSeek、通义千问等。\n\n**什么是 OpenAI 兼容协议？**\nOpenAI 定义了一套标准的 AI 对话 API 格式（Chat Completions API）。很多 AI 服务商为了方便迁移，提供了与 OpenAI 相同格式的 API 接口。你只需要更换 Base URL 和 API Key，就能无缝切换服务商。\n\n**支持的服务商及配置：**\n\n1. **OpenAI**\n   - Base URL: `https://api.openai.com/v1`\n   - 模型: gpt-4, gpt-4o, gpt-4o-mini\n   - 获取 API Key: https://platform.openai.com/api-keys\n\n2. **DeepSeek**（推荐，性价比高）\n   - Base URL: `https://api.deepseek.com/v1`\n   - 模型: deepseek-chat, deepseek-coder\n   - 获取 API Key: https://platform.deepseek.com/api_keys\n\n3. **通义千问（Qwen）**\n   - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`\n   - 模型: qwen-turbo, qwen-plus, qwen-max\n   - 获取 API Key: https://dashscope.console.aliyun.com/\n\n4. **Moonshot（月之暗面）**\n   - Base URL: `https://api.moonshot.cn/v1`\n   - 模型: moonshot-v1-8k, moonshot-v1-32k\n   - 获取 API Key: https://platform.moonshot.cn/\n\n5. **智谱 AI（GLM）**\n   - Base URL: `https://open.bigmodel.cn/api/paas/v4`\n   - 模型: glm-4, glm-4-flash, glm-4-air\n   - 获取 API Key: https://open.bigmodel.cn/\n\n6. **本地 Ollama**（完全免费，无需 API Key）\n   - Base URL: `http://localhost:11434/v1`\n   - 模型: llama3, qwen2, codellama\n   - 安装: https://ollama.ai/\n\n**配置步骤：**\n```\n1. 打开 AI Commit 配置面板（点击状态栏齿轮图标）\n2. 在 API Key 输入框填入你的密钥\n3. 在 Base URL 输入框填入服务商地址\n4. 在模型名称输入框填入模型名\n5. 点击"测试连接"按钮验证配置\n6. 连接成功后即可使用\n```\n\n**环境变量引用：**\nAPI Key 支持环境变量引用，格式为 `${env:YOUR_ENV_NAME}`。这样你可以避免在配置中硬编码密钥。\n\n**模型列表自动获取：**\n点击模型名称输入框旁的刷新按钮，AI Commit 会从 API 自动拉取可用模型列表，方便你选择。' },
  streaming: { title: 'SSE 流式响应', content: 'SSE（Server-Sent Events）流式响应是 AI Commit 的一项重要特性，它让 AI 生成的内容逐步显示在界面上，而不是等待全部生成完毕后一次性显示。\n\n**为什么需要流式响应？**\nAI 生成 commit 信息通常需要 2-5 秒。如果使用传统方式，你需要盯着空白界面等待，不知道 AI 在做什么。开启流式响应后，AI 的输出会像打字机一样逐字显示，你可以：\n- 立即看到 AI 正在生成什么内容\n- 如果方向不对，可以提前取消\n- 心理感知等待时间更短\n\n**工作原理：**\n```\n传统方式:\n客户端 → 发送请求 → 等待... → 一次性返回完整响应\n\n流式方式:\n客户端 → 发送请求（stream: true）→ 持续接收 SSE 事件\n  event: {"choices":[{"delta":{"content":"feat"}}]}\n  event: {"choices":[{"delta":{"content":"(auth):"}}]}\n  event: {"choices":[{"delta":{"content":" 添加登录"}}]}\n  ...直到完成\n```\n\n**Token 用量精确统计：**\n流式响应支持 `stream_options.include_usage` 参数，AI 会在最后一个事件中返回精确的 Token 用量数据（prompt_tokens + completion_tokens），用于费用计算。\n\n**配置方式：**\n- `aicommit.enableStreaming`: 默认为 `true`（开启）\n- 如果你的 API 服务不支持 SSE，可以设为 `false`\n- 关闭后，AI Commit 会等待完整响应再显示\n\n**取消生成：**\n在生成过程中，你可以随时点击"取消生成"按钮（或按 Esc 键），AI Commit 会立即中断请求，不会浪费更多 Token。' },
  templates: { title: '7 种 Prompt 模板', content: 'AI Commit 内置 7 种 Prompt 模板，每种模板针对不同的使用场景和团队规范。你可以通过 `aicommit.promptTemplate` 配置选择模板。\n\n**1. Bullet（默认推荐）**\nAI Commit 内置的要点式风格，标题行末尾加冒号，正文每行一个变更点。\n```\nfeat(auth): 添加用户登录功能:\n- 实现 JWT 认证中间件;\n- 添加登录表单验证;\n- 集成 OAuth 第三方登录。\n```\n\n**2. Conventional Expert**\n标准的 Conventional Commits 格式，适合遵循 Angular 提交规范的团队。\n```\nfeat(auth): add JWT-based user login\n\nImplement JWT authentication middleware, add login form\nvalidation, and integrate OAuth third-party login.\n```\n\n**3. Concise**\n简洁风格，只生成标题行和极短的正文，适合个人项目或快速迭代。\n```\nfeat(auth): add user login\n\nAdd JWT auth and form validation\n```\n\n**4. Detailed**\n详细风格，包含变更动机、实现方式和风险评估，适合需要详细记录的大型项目。\n```\nfeat(auth): add user login\n\nMotivation: Users need secure authentication\nImplementation: JWT tokens with refresh mechanism\nRisk: Token expiry may cause session drops\n```\n\n**5. Semantic**\n语义化风格，使用结构化 XML 格式分析变更，适合需要机器解析的场景。\n```xml\n<change type="feature" scope="auth">\n  <summary>Add user login</summary>\n  <files>auth.ts, login.ts</files>\n  <impact>medium</impact>\n</change>\n```\n\n**6. Team**\n团队协作风格，支持破坏性变更标记和 Issue 关联，适合多人协作项目。\n```\nfeat(auth)!: add user login\n\nBREAKING CHANGE: Old session API removed\nCloses #123\n\n- Add JWT authentication\n- Add OAuth integration\n```\n\n**7. Custom（自定义）**\n完全自定义 Prompt 模板，通过 `aicommit.customPromptTemplate` 配置。支持以下占位符：\n- `{diff}` - 代码变更内容\n- `{style}` - 提交风格\n- `{language}` - 提交语言\n- `{scope}` - 变更范围\n\n```\n自定义模板示例:\n请根据以下代码变更生成 commit 信息。\n风格: {style}\n语言: {language}\n变更内容:\n{diff}\n```\n\n**配置方式：**\n在配置面板的"Prompt 模板"下拉框中选择，或在 settings.json 中设置 `aicommit.promptTemplate`。' },
  groups: { title: '模型配置组', content: '模型配置组允许你创建多组 AI 配置，一键切换不同服务商或模型。这在以下场景特别有用：\n- 工作项目用公司私有部署，个人项目用 DeepSeek\n- 代码审查用 GPT-4o（更准确），日常提交用 deepseek-chat（更便宜）\n- 网络不稳定时切换到本地 Ollama\n\n**创建配置组：**\n```\n1. 打开配置面板（点击状态栏齿轮图标）\n2. 找到"模型配置组"区域\n3. 点击"+"按钮添加新组\n4. 填写组名、模型、API Key、Base URL 等\n5. 点击保存\n```\n\n**配置组字段说明：**\n- **名称**：配置组的标识，如"DeepSeek"、"公司私有"\n- **模型**：AI 模型名称，如 deepseek-chat、gpt-4o\n- **API Key**：密钥，加密存储在 VSCode SecretStorage\n- **Base URL**：API 地址\n- **温度**：生成随机性，0-2 之间\n- **Max Tokens**：最大生成 Token 数\n\n**切换配置组：**\n三种方式切换：\n1. 点击状态栏的配置组名称\n2. 命令面板执行"AI Commit: 切换模型配置组"\n3. 在配置面板中点击对应组的"切换"按钮\n\n**编辑和删除：**\n- 点击组名旁的编辑图标修改配置\n- 点击删除图标移除配置组\n- 删除前会确认，防止误操作\n\n**安全说明：**\n所有配置组的 API Key 都使用 VSCode SecretStorage 加密存储，不会明文保存在 settings.json 中。当你重命名配置组时，密钥会自动迁移到新名称下。\n\n**配置项：**\n- `aicommit.modelGroups`: 配置组列表（JSON 数组）\n- `aicommit.activeModelGroup`: 当前活跃配置组名称' },
  usage: { title: '用量统计', content: 'AI Commit 提供全面的 Token 用量追踪与费用管理功能，帮助你了解 AI 使用成本并控制预算。\n\n**什么是 Token？**\nToken 是 AI 模型计费的基本单位。大约 1 个英文单词 = 1.3 个 Token，1 个中文字 ≈ 2 个 Token。每次调用 AI API 都会消耗 Token，包括输入（prompt）和输出（completion）两部分。\n\n**统计维度：**\n- **今日用量**：今天消耗的 Token 数和费用\n- **本周用量**：本周累计 Token 数和费用\n- **本月用量**：本月累计 Token 数和费用\n- **日均用量**：平均每天消耗的 Token 数\n- **总调用次数**：累计调用 AI API 的次数\n- **日均费用**：平均每天的 AI 费用\n\n**14 天趋势图：**\n配置面板中展示近 14 天的用量趋势，包含：\n- 柱状图：每日 Token 消耗量\n- 折线图：每日费用变化\n\n**预算告警：**\n设置日预算和月预算后，AI Commit 会在用量达到阈值时弹出通知：\n- 80% 预算：警告通知（黄色）\n- 100% 预算：超限通知（红色），此时仍可继续使用\n\n配置项：\n- `aicommit.dailyBudget`: 日预算金额（0 = 不限制）\n- `aicommit.monthlyBudget`: 月预算金额（0 = 不限制）\n\n**多币种支持：**\n- 支持 USD（美元）和 CNY（人民币）两种货币\n- 可自定义汇率（`aicommit.exchangeRate`，默认 7.2）\n- 配置项：`aicommit.currency`\n\n**自定义模型单价：**\n如果内置的模型定价表不包含你使用的模型，可以通过 `aicommit.customModelPricing` 配置自定义单价：\n```json\n{\n  "custom-model-name": {\n    "inputPrice": 0.001,\n    "outputPrice": 0.002,\n    "unit": "1K tokens"\n  }\n}\n```\n\n**数据导出：**\n点击"导出用量数据"按钮，可以将用量统计导出为 JSON 或 CSV 格式，方便进一步分析或报销。\n\n**数据保留：**\n用量数据保留 90 天，超过 90 天的历史数据会自动清理。' },
  proxy: { title: '代理支持', content: '如果你在公司网络或需要通过代理访问外网，AI Commit 提供了完整的代理支持，无需额外安装依赖。\n\n**支持的代理协议：**\n\n1. **HTTP/HTTPS 代理**\n最常用的代理类型，格式：`http://host:port`\n```\n示例: http://proxy.company.com:8080\n```\n\n2. **SOCKS5 代理**\n更安全的代理协议，格式：`socks5://host:port`\n```\n示例: socks5://127.0.0.1:1080\n```\n\n3. **带认证的代理**\n需要用户名密码的代理，格式：`protocol://user:password@host:port`\n```\n示例: http://admin:secret@proxy.company.com:8080\n```\n\n**环境变量自动回退：**\n如果你没有在 AI Commit 中配置代理，它会自动检测以下环境变量：\n- `HTTP_PROXY` / `http_proxy`\n- `HTTPS_PROXY` / `https_proxy`\n- `ALL_PROXY` / `all_proxy`\n\n这意味着如果你已经在系统或终端中配置了代理环境变量，AI Commit 会自动使用，无需重复配置。\n\n**配置方式：**\n在配置面板的"代理地址"输入框中填入代理地址，留空则不使用代理。\n\n配置项：`aicommit.proxy`\n\n**常见问题：**\n- 代理连接失败？检查代理地址格式和端口是否正确\n- SOCKS5 不工作？确保你的 SOCKS5 代理支持 CONNECT 方法\n- 公司代理需要认证？使用 user:password 格式\n- 本地代理？确保代理服务已启动（如 Clash、V2Ray）' },
  project: { title: '项目级配置', content: 'AI Commit 支持项目级配置文件，允许每个项目使用不同的 AI 设置。这在以下场景特别有用：\n- 不同项目使用不同的 AI 模型\n- 团队项目统一提交风格\n- 开源项目和个人项目使用不同的 API Key\n\n**.aicommitrc.json 配置文件：**\n在项目根目录创建 `.aicommitrc.json` 文件，可以覆盖用户级配置：\n```json\n{\n  "model": "deepseek-chat",\n  "baseUrl": "https://api.deepseek.com/v1",\n  "temperature": 0.5,\n  "maxTokens": 300,\n  "format": "bullet",\n  "commitLanguage": "Chinese",\n  "promptTemplate": "bullet"\n}\n```\n\n**优先级规则：**\n```\n项目级配置 (.aicommitrc.json) > 用户级配置 (settings.json) > 默认值\n```\n\n**.aicommitignore 文件过滤：**\n在项目根目录创建 `.aicommitignore` 文件，排除不需要分析的文件。格式与 `.gitignore` 完全相同：\n```\n# 排除自动生成的文件\n*.generated.ts\nsrc/generated/**\n\n# 排除第三方库\nnode_modules/**\nvendor/**\n\n# 排除大型数据文件\n*.sql\n*.csv\n```\n\n**文件监听与自动重载：**\nAI Commit 会监听 `.aicommitrc.json` 和 `.aicommitignore` 文件的变化。当你修改这些文件后，配置会自动重新加载，无需重启 VSCode。\n\n**团队协作建议：**\n- 将 `.aicommitrc.json` 提交到 Git 仓库，团队成员共享配置\n- 将 `.aicommitignore` 提交到 Git 仓库，统一排除规则\n- API Key 不要写在 .aicommitrc.json 中，应通过配置面板管理\n\n**多工作区支持：**\n在 VSCode 多根工作区中，AI Commit 会自动识别当前活动文件所在的仓库，使用对应的项目级配置。' },
  security: { title: '密钥安全', content: 'API Key 的安全存储是 AI Commit 的重要设计考量。我们采用了 VSCode 内置的 SecretStorage 机制来保护你的密钥。\n\n**什么是 SecretStorage？**\nSecretStorage 是 VSCode 提供的安全存储机制，用于保存敏感信息（如密码、API Key）。它使用操作系统的密钥管理服务：\n- Windows: Windows Credential Manager\n- macOS: Keychain\n- Linux: Secret Service API (libsecret)\n\n**安全机制详解：**\n\n1. **加密存储**\nAPI Key 存储在 SecretStorage 中，而不是 settings.json。这意味着：\n- 你的密钥不会以明文形式出现在配置文件中\n- 同步 settings.json 到 Git 不会泄露密钥\n- 即使别人获取了你的 settings.json，也无法看到 API Key\n\n2. **Settings Sync 兼容**\nVSCode 的 Settings Sync 功能会同步你的设置到云端。由于 API Key 不在 settings.json 中，它不会被同步。当你在新设备上恢复设置后，AI Commit 会检测到密钥为空，自动提示你重新输入。\n\n3. **配置组独立管理**\n每个模型配置组有独立的 API Key。当你切换配置组时，对应的密钥会自动加载。\n\n4. **重命名自动迁移**\n当你重命名配置组时，AI Commit 会自动将旧名称下的密钥迁移到新名称，无需重新输入。\n\n5. **环境变量引用**\n如果你不想将 API Key 存储在任何地方，可以使用环境变量引用：\n```\nAPI Key 输入框填入: ${env:MY_API_KEY}\n```\n这样 AI Commit 会从系统环境变量 MY_API_KEY 读取密钥。\n\n**最佳实践：**\n- 不要将 API Key 写入 settings.json 或 .aicommitrc.json\n- 使用环境变量引用或通过配置面板管理密钥\n- 定期轮换 API Key\n- 不要将 API Key 提交到 Git 仓库' },
}

const featureDetailsEn: Record<string, { title: string; content: string }> = {
  ai: { title: 'AI-Powered Generation', content: 'AI Commit is an AI-powered Git commit message generator. It reads your code changes (git diff), analyzes the content and intent through AI, and automatically generates conventional commit messages.\n\n**What is git diff?**\ngit diff is a Git command that shows code changes. When you modify files, git diff displays added lines (green +) and deleted lines (red -). AI Commit reads these changes to understand what you modified.\n\n**Two diff sources:**\n- Staged diff (default): `git diff --cached`, only analyzes files you have git added\n- Unstaged diff: `git diff`, analyzes all unstaged modifications\n\nSwitch via `aicommit.diffSource`. Use staged if you add before committing; use unstaged to preview before adding.\n\n**Candidate Selection:**\nAI Commit generates 1-5 candidate messages, presented via VSCode QuickPick. Configure count with `aicommit.candidateCount`.\n\n**Large Diff Handling:**\nWhen changes exceed `aicommit.diffTruncateThreshold` (default 3000 lines), AI Commit prompts with three options: continue, partial analysis, or cancel.\n\n**Auto-detect Scope:**\nWith `aicommit.autoDetectScope` enabled (default), AI Commit infers scope from affected directories. E.g., modifying src/auth/ sets scope to auth.\n\n**Project Context Enhancement:**\nWith `aicommit.enableProjectContext`, AI Commit attaches project name and recent 5 commits as context.\n\n**Usage Example:**\n```\n1. After modifying code, click the sparkle icon in Source Control\n2. Wait for AI analysis (streaming, ~1-3 seconds)\n3. Select the best commit message from QuickPick\n4. Message auto-fills the commit input, click commit\n```\n\n**Generated Message Example:**\n```\nfeat(auth): add user login:\n- Implement JWT authentication middleware;\n- Add login form validation;\n- Integrate OAuth third-party login;\n- Persist login state to localStorage.\n```' },
  openai: { title: 'OpenAI Compatible', content: 'AI Commit works with any AI provider that follows the OpenAI Chat Completions API protocol. You are not limited to OpenAI — you can use DeepSeek, Qwen, and other compatible services.\n\n**What is OpenAI-compatible protocol?**\nOpenAI defined a standard AI chat API format. Many providers offer the same format for easy migration. Just change the Base URL and API Key to switch providers.\n\n**Supported Providers:**\n\n1. **OpenAI** — Base URL: `https://api.openai.com/v1` — Models: gpt-4, gpt-4o\n2. **DeepSeek** (recommended) — Base URL: `https://api.deepseek.com/v1` — Models: deepseek-chat\n3. **Qwen** — Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1` — Models: qwen-turbo, qwen-plus\n4. **Moonshot** — Base URL: `https://api.moonshot.cn/v1` — Models: moonshot-v1-8k\n5. **GLM** — Base URL: `https://open.bigmodel.cn/api/paas/v4` — Models: glm-4\n6. **Local Ollama** (free, no API Key) — Base URL: `http://localhost:11434/v1` — Models: llama3, qwen2\n\n**Configuration Steps:**\n```\n1. Open AI Commit config panel (click gear icon in status bar)\n2. Enter your API Key\n3. Enter the Base URL\n4. Enter the model name\n5. Click "Test Connection" to verify\n6. Start generating commit messages!\n```\n\n**Environment Variable Reference:**\nAPI Key supports `${env:YOUR_ENV_NAME}` format to avoid hardcoding.\n\n**Auto-fetch Model List:**\nClick the refresh button next to the model input to fetch available models from the API.' },
  streaming: { title: 'SSE Streaming', content: 'SSE (Server-Sent Events) streaming lets AI output appear progressively instead of waiting for the complete response.\n\n**Why streaming?**\nAI generation takes 2-5 seconds. Without streaming, you stare at a blank screen. With streaming, output appears like a typewriter — you can see what AI is generating and cancel early if needed.\n\n**How it works:**\n```\nTraditional: Client → Request → Wait... → Full response\nStreaming:   Client → Request (stream: true) → Continuous SSE events\n```\n\n**Accurate Token Usage:**\nStreaming supports `stream_options.include_usage` for precise token counting in the final event.\n\n**Configuration:**\n- `aicommit.enableStreaming`: default `true`\n- Set to `false` if your API does not support SSE\n\n**Cancel Generation:**\nClick "Cancel" or press Esc during generation to immediately abort the request.' },
  templates: { title: '7 Prompt Templates', content: 'AI Commit includes 7 built-in prompt templates for different scenarios. Configure via `aicommit.promptTemplate`.\n\n**1. Bullet** (default) — Bullet-point style with colon at title end\n**2. Conventional Expert** — Standard Conventional Commits format\n**3. Concise** — Minimal style, title + short body\n**4. Detailed** — Verbose with motivation, implementation, and risk\n**5. Semantic** — Structured XML format for machine parsing\n**6. Team** — Team collaboration style with breaking change markers and Issue linking\n**7. Custom** — Fully customizable via `aicommit.customPromptTemplate`\n\nPlaceholders for custom templates: `{diff}`, `{style}`, `{language}`, `{scope}`' },
  groups: { title: 'Model Groups', content: 'Model configuration groups let you create multiple AI configs and switch with one click.\n\n**Use Cases:**\n- Work projects use company deployment, personal projects use DeepSeek\n- Code review uses GPT-4o (more accurate), daily commits use deepseek-chat (cheaper)\n- Switch to local Ollama when network is unstable\n\n**Creating a Group:**\n```\n1. Open config panel (gear icon in status bar)\n2. Find "Model Configuration Groups" section\n3. Click "+" to add a new group\n4. Fill in name, model, API Key, Base URL, etc.\n5. Click save\n```\n\n**Switching Groups:**\n1. Click group name in status bar\n2. Command palette: "AI Commit: Switch Model Group"\n3. Click "Switch" button in config panel\n\n**Security:**\nAll API Keys are encrypted in VSCode SecretStorage. Keys auto-migrate when renaming groups.\n\n**Config:**\n- `aicommit.modelGroups`: group list (JSON array)\n- `aicommit.activeModelGroup`: active group name' },
  usage: { title: 'Usage Statistics', content: 'Comprehensive token usage tracking and cost management.\n\n**What are Tokens?**\nTokens are the billing unit for AI models. ~1 English word = 1.3 tokens, ~1 Chinese character = 2 tokens.\n\n**Metrics:**\n- Today/Week/Month token usage and cost\n- 14-day usage trend chart\n- Daily average, total calls, daily cost\n\n**Budget Alerts:**\n- 80% budget: warning notification (yellow)\n- 100% budget: exceeded notification (red)\n- Config: `aicommit.dailyBudget`, `aicommit.monthlyBudget`\n\n**Multi-currency:**\n- USD and CNY supported\n- Custom exchange rate via `aicommit.exchangeRate`\n- Config: `aicommit.currency`\n\n**Custom Model Pricing:**\n```json\n{\n  "custom-model": {\n    "inputPrice": 0.001,\n    "outputPrice": 0.002,\n    "unit": "1K tokens"\n  }\n}\n```\n\n**Data Export:**\nExport usage data as JSON or CSV for analysis or reimbursement.\n\n**Data Retention:**\nUsage data is retained for 90 days.' },
  proxy: { title: 'Proxy Support', content: 'Native proxy implementation with no extra dependencies.\n\n**Supported Protocols:**\n1. HTTP/HTTPS: `http://host:port`\n2. SOCKS5: `socks5://host:port`\n3. Authenticated: `protocol://user:password@host:port`\n\n**Environment Variable Fallback:**\nIf no proxy is configured, AI Commit checks: HTTP_PROXY, HTTPS_PROXY, ALL_PROXY\n\n**Config:** `aicommit.proxy`\n\n**Troubleshooting:**\n- Connection failed? Check address format and port\n- SOCKS5 not working? Ensure your proxy supports CONNECT method\n- Company proxy needs auth? Use user:password format' },
  project: { title: 'Project Config', content: 'Project-level configuration files allow each project to use different AI settings.\n\n**.aicommitrc.json:**\nCreate in project root to override user-level settings:\n```json\n{\n  "model": "deepseek-chat",\n  "baseUrl": "https://api.deepseek.com/v1",\n  "temperature": 0.5,\n  "maxTokens": 300,\n  "format": "bullet"\n}\n```\n\n**Priority:**\nProject config > User config > Defaults\n\n**.aicommitignore:**\nExclude files from analysis, same format as .gitignore:\n```\n*.generated.ts\nnode_modules/**\n*.sql\n```\n\n**Auto-reload:**\nChanges to .aicommitrc.json and .aicommitignore are detected and applied immediately.\n\n**Team Collaboration:**\n- Commit .aicommitrc.json to share settings\n- Commit .aicommitignore to share exclusion rules\n- Never put API Keys in .aicommitrc.json' },
  security: { title: 'Secure Keys', content: 'API Key security is a core design consideration in AI Commit.\n\n**What is SecretStorage?**\nVSCode SecretStorage uses OS key management:\n- Windows: Windows Credential Manager\n- macOS: Keychain\n- Linux: Secret Service API (libsecret)\n\n**Security Features:**\n1. **Encrypted Storage** — Keys stored in SecretStorage, not settings.json\n2. **Settings Sync Compatible** — Keys not synced; auto-prompt on new device\n3. **Independent Key Management** — Each config group has its own API Key\n4. **Auto-migration on Rename** — Keys move with renamed groups\n5. **Environment Variable Reference** — Use `${env:MY_API_KEY}` to read from system\n\n**Best Practices:**\n- Never put API Keys in settings.json or .aicommitrc.json\n- Use environment variable references or the config panel\n- Rotate API Keys regularly\n- Never commit API Keys to Git' },
}

const iconMap: Record<string, string> = {
  ai: 'ri-robot-2-line',
  openai: 'ri-plug-line',
  streaming: 'ri-flashlight-line',
  templates: 'ri-palette-line',
  groups: 'ri-price-tag-3-line',
  usage: 'ri-bar-chart-2-line',
  proxy: 'ri-global-line',
  project: 'ri-folder-3-line',
  security: 'ri-lock-line',
}

const iconColorMap: Record<string, string> = {
  ai: '#0078d4',
  openai: '#10b981',
  streaming: '#f59e0b',
  templates: '#6c5ce7',
  groups: '#ef4444',
  usage: '#00bcf2',
  proxy: '#8b5cf6',
  project: '#f97316',
  security: '#10b981',
}

const zh = {
  nav: { features: '功能', providers: '服务商', screenshots: '截图', install: '安装', faq: 'FAQ' },
  hero: {
    tagline: '智能 Git Commit 信息生成器',
    desc: '通过 AI 大模型自动生成规范的 Git Commit 信息，支持 OpenAI 兼容协议、多种提交风格、流式响应、Token 用量统计',
    download: '下载安装',
    github: 'GitHub',
    star: '免费开源',
  },
  features: {
    title: '功能特性',
    subtitle: '为 Git 工作流而生的 AI 助手',
    list: [
      { key: 'ai', title: 'AI 驱动生成', desc: '基于 git diff 自动分析变更，生成规范的 commit 信息，支持多候选方案 QuickPick 选择' },
      { key: 'openai', title: 'OpenAI 兼容', desc: '支持所有 OpenAI 兼容 API：DeepSeek、通义千问、Moonshot、智谱 AI 等，即配即用' },
      { key: 'streaming', title: 'SSE 流式响应', desc: '实时解析 SSE 事件流，首字显示 < 1 秒，显著改善等待体验' },
      { key: 'templates', title: '7 种 Prompt 模板', desc: 'Bullet、Conventional、Concise、Detailed、Semantic、Team、自定义模板' },
      { key: 'groups', title: '模型配置组', desc: '多组 AI 配置一键切换，API Key 加密存储在 VSCode SecretStorage' },
      { key: 'usage', title: '用量统计', desc: 'Token 追踪、费用计算、预算告警、14 天趋势图、多币种支持' },
      { key: 'proxy', title: '代理支持', desc: 'HTTP/HTTPS/SOCKS5 代理，原生实现无需额外依赖，环境变量自动回退' },
      { key: 'project', title: '项目级配置', desc: '.aicommitrc.json 项目级覆盖，.aicommitignore 文件过滤' },
      { key: 'security', title: '密钥安全', desc: 'API Key 存储在 VSCode SecretStorage，支持 Settings Sync 同步' },
    ],
  },
  howItWorks: {
    title: '工作流程',
    subtitle: '三步即可开始使用',
    steps: [
      { num: '1', title: '安装扩展', desc: '从 GitHub Releases 下载 .vsix 文件，或通过 VSCode 扩展市场安装' },
      { num: '2', title: '配置 API', desc: '打开配置面板，填入 API Key、Base URL 和模型名称，点击测试连接验证' },
      { num: '3', title: '生成 Commit', desc: '在源代码管理面板点击图标，选择满意的 commit 信息即可提交' },
    ],
  },
  providers: {
    title: '支持的 AI 服务商',
    subtitle: '任何兼容 OpenAI API 协议的服务均可使用',
  },
  screenshots: {
    title: '界面截图',
    subtitle: '直观的配置面板与用量统计',
    list: [
      { id: 'config', title: '配置面板', desc: '可视化配置 API、模型、风格等参数' },
      { id: 'generate', title: '生成 Commit', desc: 'QuickPick 多候选方案选择' },
      { id: 'usage', title: '用量统计', desc: 'Token 用量追踪与费用趋势图' },
      { id: 'groups', title: '模型配置组', desc: '多组 AI 配置一键切换管理' },
    ],
  },
  styles: {
    title: '提交风格',
    subtitle: '支持多种主流 commit 格式',
    list: [
      { name: 'Conventional', example: 'feat(auth): add JWT-based user login', desc: '标准 Conventional Commits 格式' },
      { name: 'Gitmoji', example: 'auth: add JWT-based user login', desc: '语义化 Emoji 前缀' },
      { name: 'Bullet', example: 'feat(auth): 添加登录功能:\n- 实现 JWT 认证;\n- 添加表单验证。', desc: 'AI Commit 内置要点式风格' },
      { name: 'Custom', example: '[feat] 添加用户登录功能\n自定义格式模板，支持占位符替换:\n<type>(<scope>): <description>', desc: '自定义格式模板' },
    ],
  },
  faq: {
    title: '常见问题',
    list: [
      { q: '支持哪些 AI 服务商？', a: '所有兼容 OpenAI Chat Completions API 协议的服务商均可使用，包括 OpenAI、DeepSeek、通义千问、Moonshot、智谱 AI、本地 Ollama 等。只需填入对应的 Base URL 和模型名称即可。' },
      { q: 'API Key 安全吗？', a: 'API Key 使用 VSCode 内置的 SecretStorage 加密存储，不会明文保存在 settings.json 中。同时支持 Settings Sync，密钥为空时会自动提示重新输入。' },
      { q: '如何使用代理？', a: '在配置中填入代理地址即可，支持 HTTP/HTTPS/SOCKS5 三种协议，也支持带认证的代理。留空则不使用代理，也可通过环境变量 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY 配置。' },
      { q: 'Token 用量如何计费？', a: 'AI Commit 根据各模型官方定价自动计算费用，支持自定义模型单价。费用统计支持 USD/CNY 双币种，可配置汇率。' },
      { q: '可以在团队项目中使用吗？', a: '可以。通过 .aicommitrc.json 项目级配置文件，团队成员可以共享模型、风格等设置，同时各自管理自己的 API Key。' },
    ],
  },
  footer: {
    slogan: '让每一次提交都清晰规范',
    license: 'MIT License',
    copyright: '© 2025 Vogadero',
  },
}

const en = {
  nav: { features: 'Features', providers: 'Providers', screenshots: 'Screenshots', install: 'Install', faq: 'FAQ' },
  hero: {
    tagline: 'Smart Git Commit Message Generator',
    desc: 'Auto-generate conventional Git commit messages with AI. Supports OpenAI-compatible APIs, multiple commit styles, streaming responses, and token usage tracking.',
    download: 'Download',
    github: 'GitHub',
    star: 'Free & Open Source',
  },
  features: {
    title: 'Features',
    subtitle: 'An AI assistant built for Git workflows',
    list: [
      { key: 'ai', title: 'AI-Powered Generation', desc: 'Analyze git diff to auto-generate conventional commit messages with multiple QuickPick candidates' },
      { key: 'openai', title: 'OpenAI Compatible', desc: 'Works with all OpenAI-compatible APIs: DeepSeek, Qwen, Moonshot, GLM, and more' },
      { key: 'streaming', title: 'SSE Streaming', desc: 'Real-time SSE event parsing, first token in < 1 second for a smooth experience' },
      { key: 'templates', title: '7 Prompt Templates', desc: 'Bullet, Conventional, Concise, Detailed, Semantic, Team, and Custom templates' },
      { key: 'groups', title: 'Model Groups', desc: 'One-click switching between multiple AI configs, API Keys encrypted in SecretStorage' },
      { key: 'usage', title: 'Usage Statistics', desc: 'Token tracking, cost calculation, budget alerts, 14-day trends, multi-currency support' },
      { key: 'proxy', title: 'Proxy Support', desc: 'HTTP/HTTPS/SOCKS5 proxy, native implementation, environment variable fallback' },
      { key: 'project', title: 'Project Config', desc: '.aicommitrc.json project-level overrides, .aicommitignore file filtering' },
      { key: 'security', title: 'Secure Keys', desc: 'API Keys stored in VSCode SecretStorage, Settings Sync compatible' },
    ],
  },
  howItWorks: {
    title: 'How It Works',
    subtitle: 'Get started in three steps',
    steps: [
      { num: '1', title: 'Install Extension', desc: 'Download .vsix from GitHub Releases, or install via VSCode Marketplace' },
      { num: '2', title: 'Configure API', desc: 'Open config panel, enter API Key, Base URL, and model name, then test connection' },
      { num: '3', title: 'Generate Commit', desc: 'Click the icon in Source Control panel, pick your preferred commit message' },
    ],
  },
  providers: {
    title: 'Supported AI Providers',
    subtitle: 'Works with any OpenAI API-compatible service',
  },
  screenshots: {
    title: 'Screenshots',
    subtitle: 'Intuitive config panel and usage statistics',
    list: [
      { id: 'config', title: 'Config Panel', desc: 'Visual configuration for API, model, style, and more' },
      { id: 'generate', title: 'Generate Commit', desc: 'QuickPick with multiple candidate messages' },
      { id: 'usage', title: 'Usage Statistics', desc: 'Token tracking and cost trend charts' },
      { id: 'groups', title: 'Model Groups', desc: 'One-click switching between AI configurations' },
    ],
  },
  styles: {
    title: 'Commit Styles',
    subtitle: 'Support for multiple mainstream commit formats',
    list: [
      { name: 'Conventional', example: 'feat(auth): add JWT-based user login', desc: 'Standard Conventional Commits format' },
      { name: 'Gitmoji', example: 'auth: add JWT-based user login', desc: 'Semantic Emoji prefix' },
      { name: 'Bullet', example: 'feat(auth): add user login:\n- Implement JWT auth;\n- Add form validation.', desc: 'AI Commit built-in bullet style' },
      { name: 'Custom', example: '[feat] Add user login feature\n\nCustom format template with placeholders:\n<type>(<scope>): <description>', desc: 'Custom format template' },
    ],
  },
  faq: {
    title: 'FAQ',
    list: [
      { q: 'Which AI providers are supported?', a: 'Any provider compatible with the OpenAI Chat Completions API protocol, including OpenAI, DeepSeek, Qwen, Moonshot, GLM, and local Ollama. Just enter the Base URL and model name.' },
      { q: 'Is my API Key secure?', a: "API Keys are encrypted using VSCode's built-in SecretStorage and are never stored in plain text in settings.json. Settings Sync is also supported with auto-prompt for re-entry." },
      { q: 'How to use a proxy?', a: 'Enter the proxy address in settings. HTTP/HTTPS/SOCKS5 protocols are supported, including authenticated proxies. Leave empty to disable, or use HTTP_PROXY / HTTPS_PROXY / ALL_PROXY environment variables.' },
      { q: 'How is token usage billed?', a: "AI Commit automatically calculates costs based on each model's official pricing. Custom model pricing is supported. USD/CNY dual currency with configurable exchange rate." },
      { q: 'Can I use it in team projects?', a: 'Yes. Through .aicommitrc.json project-level config, team members can share model and style settings while managing their own API Keys independently.' },
    ],
  },
  footer: {
    slogan: 'Make every commit clear and conventional',
    license: 'MIT License',
    copyright: '© 2025 Vogadero',
  },
}

const providers = [
  { name: 'OpenAI', nameEn: 'OpenAI', url: 'api.openai.com/v1', models: 'gpt-4o, o3-mini, gpt-4o-mini', bg: '#10b981', logo: 'openai' },
  { name: 'DeepSeek', nameEn: 'DeepSeek', url: 'api.deepseek.com/v1', models: 'deepseek-chat (V3.2), deepseek-reasoner (R1)', bg: '#0078d4', logo: 'deepseek' },
  { name: '通义千问', nameEn: 'Qwen', url: 'dashscope.aliyuncs.com', models: 'qwen3-max, qwen3-235b, qwen-turbo', bg: '#6c5ce7', logo: 'qwen' },
  { name: 'Moonshot', nameEn: 'Moonshot', url: 'api.moonshot.cn/v1', models: 'kimi-k2, moonshot-v1-128k', bg: '#f59e0b', logo: 'moonshot' },
  { name: '智谱 AI', nameEn: 'Zhipu AI', url: 'open.bigmodel.cn', models: 'glm-5, glm-4.7-flash', bg: '#ef4444', logo: 'chatglm' },
  { name: 'Ollama', nameEn: 'Ollama', url: 'localhost:11434/v1', models: 'llama3, qwen3, deepseek-r1', bg: '#8b5cf6', logo: 'ollama' },
]

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView()
  return (
    <div ref={ref} className={`fade-in ${visible ? 'visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function TypingText({ text, speed = 40 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(timer)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])
  return <span>{displayed}<span className={`typing-cursor ${done ? 'blink' : ''}`}>|</span></span>
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 5))
      if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.25))
      if (e.key === '0') { setScale(1); setPos({ x: 0, y: 0 }) }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(Math.max(s + (e.deltaY > 0 ? -0.15 : 0.15), 0.25), 5))
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('wheel', wheel, { passive: false })
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('wheel', wheel); document.body.style.overflow = '' }
  }, [onClose])

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    setPos(p => ({ x: p.x + dx, y: p.y + dy }))
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => { setIsDragging(false) }

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-toolbar" onClick={e => e.stopPropagation()}>
        <button onClick={() => setScale(s => Math.min(s + 0.25, 5))} title="Zoom In"><i className="ri-zoom-in-line" /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.25, 0.25))} title="Zoom Out"><i className="ri-zoom-out-line" /></button>
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }) }} title="Reset"><i className="ri-fullscreen-line" /></button>
        <span className="lightbox-scale">{Math.round(scale * 100)}%</span>
        <button onClick={onClose} title="Close"><i className="ri-close-line" /></button>
      </div>
      <div
        className="lightbox-content"
        onClick={e => e.stopPropagation()}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={src}
          alt={alt}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease' }}
          draggable={false}
        />
      </div>
    </div>
  )
}

function FeatureDetail({ detail, onClose }: { detail: { title: string; content: string }; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/, '').replace(/```$/, '')
        return <pre key={i} className="detail-code">{code}</pre>
      }
      const lines = part.split('\n')
      return lines.map((line, j) => {
        if (!line) return <br key={`${i}-${j}`} />
        const boldMatch = line.match(/^\*\*(.*?)\*\*(.*)/)
        if (boldMatch) return <p key={`${i}-${j}`}><strong>{boldMatch[1]}</strong>{boldMatch[2]}</p>
        if (line.startsWith('- ')) return <p key={`${i}-${j}`} className="detail-li">{line}</p>
        if (/^\d+\.\s/.test(line)) return <p key={`${i}-${j}`} className="detail-ol">{line}</p>
        return <p key={`${i}-${j}`}>{line}</p>
      })
    })
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel detail-panel-enter" onClick={e => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose}><i className="ri-close-line" /></button>
        <div className="detail-header-glow" />
        <h2>{detail.title}</h2>
        <div className="detail-body">{renderContent(detail.content)}</div>
      </div>
    </div>
  )
}

function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [featureDetail, setFeatureDetail] = useState<{ title: string; content: string } | null>(null)
  const t = lang === 'zh' ? zh : en
  const details = lang === 'zh' ? featureDetailsZh : featureDetailsEn

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src="/AiCommit/images/icon.png" alt="AI Commit" />
            <span>AI Commit</span>
          </a>
          <ul className="nav-links">
            <li><a href="#features">{t.nav.features}</a></li>
            <li><a href="#install">{t.nav.install}</a></li>
            <li><a href="#providers">{t.nav.providers}</a></li>
            <li><a href="#screenshots">{t.nav.screenshots}</a></li>
            <li><a href="#faq">{t.nav.faq}</a></li>
            <li className="nav-actions">
              <div className="nav-pill-group">
                <button className={`nav-pill ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode">
                  <i className="ri-sun-line" />
                </button>
                <button className={`nav-pill ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode">
                  <i className="ri-moon-line" />
                </button>
              </div>
              <button className="nav-lang-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
                <i className="ri-translate-2" />
                <span>{lang === 'zh' ? 'EN' : '中文'}</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="hero-bg-grid" />
        <div className="hero-particles">
          {[...Array(6)].map((_, i) => <div key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />)}
        </div>
        <div className="hero-content">
          <img src="/AiCommit/images/icon.png" alt="AI Commit" className="hero-logo" />
          <div className="hero-badge"><i className="ri-star-line" /> {t.hero.star}</div>
          <h1>AI Commit</h1>
          <p className="hero-tagline"><TypingText text={t.hero.tagline} speed={50} /></p>
          <p className="hero-desc">{t.hero.desc}</p>
          <div className="hero-buttons">
            <a href="https://github.com/Vogadero/AiCommit/releases/latest" className="btn-primary" target="_blank" rel="noopener noreferrer">
              <i className="ri-download-line" /> {t.hero.download}
            </a>
            <a href="https://github.com/Vogadero/AiCommit" className="btn-secondary" target="_blank" rel="noopener noreferrer">
              <i className="ri-github-fill" /> {t.hero.github}
            </a>
          </div>
        </div>
        <div className="hero-scroll-hint">
          <i className="ri-arrow-down-s-line" />
        </div>
      </section>

      <section id="features">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.features.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.features.subtitle}</p></FadeIn>
          <div className="features-grid">
            {t.features.list.map((f, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="feature-card" onClick={() => setFeatureDetail(details[f.key])} role="button" tabIndex={0} style={{ '--icon-color': iconColorMap[f.key] } as React.CSSProperties}>
                  <div className="feature-icon"><i className={iconMap[f.key]} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <span className="feature-arrow"><i className="ri-arrow-right-line" /></span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="install" className="section-alt">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.howItWorks.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.howItWorks.subtitle}</p></FadeIn>
          <div className="install-steps">
            {t.howItWorks.steps.map((s, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="install-step">
                  <div className="step-num">{s.num}</div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="styles-showcase">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.styles.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.styles.subtitle}</p></FadeIn>
          <div className="styles-grid">
            {t.styles.list.map((s, i) => (
              <FadeIn key={i} delay={i * 70}>
                <div className="style-card">
                  <div className="style-name">{s.name}</div>
                  <pre className="style-example">{s.example}</pre>
                  <p className="style-desc">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="providers" className="section-alt">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.providers.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.providers.subtitle}</p></FadeIn>
          <div className="providers-grid">
            {providers.map((p, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="provider-card">
                  <div className="provider-logo-wrap" style={{ background: p.bg + '18' }}>
                    <img
                      src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${p.logo}.svg`}
                      alt={p.nameEn}
                      className="provider-logo-img"
                      onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; const s = img.nextElementSibling; if (s) (s as HTMLElement).style.display = 'flex'; }}
                    />
                    <span className="provider-logo-letter" style={{ display: 'none' }}>{p.nameEn.charAt(0)}</span>
                  </div>
                  <h4>{lang === 'zh' ? p.name : p.nameEn}</h4>
                  <code>{p.url}</code>
                  <small>{p.models}</small>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="screenshots">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.screenshots.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.screenshots.subtitle}</p></FadeIn>
          <div className="screenshots-grid">
            {t.screenshots.list.map((s, i) => (
              <FadeIn key={i} delay={i * 70}>
                <div className="screenshot-card" onClick={() => setLightbox({ src: `/AiCommit/images/screenshot-${s.id}.png`, alt: s.title })}>
                  <div className="screenshot-img-wrap">
                    <img src={`/AiCommit/images/screenshot-${s.id}.png`} alt={s.title} />
                    <div className="screenshot-zoom"><i className="ri-zoom-in-line" /></div>
                  </div>
                  <div className="screenshot-info">
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section-alt">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.faq.title}</h2></FadeIn>
          <div className="faq-list">
            {t.faq.list.map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className={`faq-item ${faqOpen === i ? 'open' : ''}`} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <div className="faq-question">
                    <span>{item.q}</span>
                    <i className="ri-arrow-down-s-line faq-chevron" />
                  </div>
                  <div className="faq-answer">
                    <p>{item.a}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/AiCommit/images/icon.png" alt="AI Commit" className="footer-logo" />
              <span>AI Commit</span>
            </div>
            <p className="footer-slogan">{t.footer.slogan}</p>
          </div>
          <div className="footer-links">
            <a href="https://github.com/Vogadero/AiCommit" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/Vogadero/AiCommit/releases" target="_blank" rel="noopener noreferrer">Releases</a>
            <a href="https://github.com/Vogadero/AiCommit/issues" target="_blank" rel="noopener noreferrer">Issues</a>
          </div>
          <div className="footer-bottom">
            <span>{t.footer.license}</span>
            <span>{t.footer.copyright} <a href="https://github.com/Vogadero" target="_blank" rel="noopener noreferrer">Vogadero</a></span>
          </div>
        </div>
      </footer>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      {featureDetail && <FeatureDetail detail={featureDetail} onClose={() => setFeatureDetail(null)} />}
    </>
  )
}

export default App
