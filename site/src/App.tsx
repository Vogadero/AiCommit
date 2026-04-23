import { useState, useEffect, useRef, useCallback } from 'react'
import './styles/global.css'

const featureDetailsZh: Record<string, { title: string; content: string }> = {
  ai: { title: 'AI 驱动生成', content: 'AI Commit 基于 git diff 自动分析代码变更，通过 AI 大模型生成规范的 commit 信息。\n\n**核心能力：**\n- 自动分析暂存区或工作区 diff\n- 一次生成 1-5 条候选方案\n- 大 diff 自动截断，提供三选项\n- 自动检测变更范围（scope）\n- 项目上下文增强\n\n**示例：**\n```\n输入: git diff --cached\n输出:\nfeat(auth): 添加用户登录功能:\n- 实现 JWT 认证;\n- 添加表单验证;\n- 集成 OAuth 登录。\n```' },
  openai: { title: 'OpenAI 兼容', content: '兼容所有 OpenAI Chat Completions API 协议的服务商。\n\n**支持的服务商：**\n- OpenAI (gpt-4, gpt-4o)\n- DeepSeek (deepseek-chat)\n- 通义千问 (qwen-turbo, qwen-plus)\n- Moonshot (moonshot-v1-8k)\n- 智谱 AI (glm-4)\n- 本地 Ollama (llama3)\n\n只需填入 Base URL 和模型名称即可使用。' },
  streaming: { title: 'SSE 流式响应', content: '启用流式响应后，AI 生成结果逐步显示，首字显示时间 < 1 秒。\n\n**工作原理：**\n- 请求发送 `stream: true` 参数\n- 实时解析 SSE 事件流\n- 支持 `stream_options.include_usage` 获取精确 Token 用量\n\n**配置：**\n- `aicommit.enableStreaming`: 默认开启\n- 关闭后等待完整响应再显示' },
  templates: { title: '7 种 Prompt 模板', content: '内置 7 种 Prompt 模板，满足不同场景需求。\n\n1. **Bullet**（默认）— 要点式，标题末尾冒号\n2. **Conventional Expert** — 标准 Conventional Commits\n3. **Concise** — 简洁风格\n4. **Detailed** — 详细风格，含动机和风险评估\n5. **Semantic** — 结构化 XML 格式\n6. **Team** — 团队协作风格\n7. **Custom** — 自定义模板\n\n配置项: `aicommit.promptTemplate`' },
  groups: { title: '模型配置组', content: '创建多组 AI 配置，一键切换不同服务商。\n\n**功能：**\n- 每组独立配置：模型、API Key、Base URL、温度、Max Tokens\n- API Key 加密存储在 VSCode SecretStorage\n- 状态栏实时显示当前组名\n- 支持添加、编辑、删除操作\n\n**配置：**\n- `aicommit.modelGroups`: 配置组列表\n- `aicommit.activeModelGroup`: 当前活跃组' },
  usage: { title: '用量统计', content: '全面的 Token 用量追踪与费用管理。\n\n**统计维度：**\n- 今日/本周/本月 Token 用量\n- 近 14 天用量趋势图\n- 日均用量、总调用次数、日均费用\n\n**预算管理：**\n- 日预算/月预算告警（80%/100%）\n- 多币种支持（USD/CNY）\n- 自定义模型单价\n- 用量数据导出 JSON/CSV' },
  proxy: { title: '代理支持', content: '原生代理实现，无需额外依赖。\n\n**支持协议：**\n- HTTP/HTTPS: `http://proxy:8080`\n- SOCKS5: `socks5://proxy:1080`\n- 带认证: `http://user:pass@proxy:8080`\n\n**环境变量回退：**\n- HTTP_PROXY / HTTPS_PROXY / ALL_PROXY\n\n配置项: `aicommit.proxy`' },
  project: { title: '项目级配置', content: '通过项目级配置文件覆盖用户级设置。\n\n**.aicommitrc.json：**\n```json\n{\n  "model": "deepseek-chat",\n  "temperature": 0.5,\n  "format": "bullet"\n}\n```\n\n**.aicommitignore：**\n排除不需要分析的文件，格式同 .gitignore。\n\n文件监听与自动重载，修改即时生效。' },
  security: { title: '密钥安全', content: 'API Key 安全存储方案。\n\n**安全机制：**\n- 存储在 VSCode SecretStorage，不写入 settings.json\n- 支持 Settings Sync 同步\n- 密钥为空时自动提示重新输入\n- 配置组 API Key 独立管理\n- 重命名时自动迁移密钥' },
}

const featureDetailsEn: Record<string, { title: string; content: string }> = {
  ai: { title: 'AI-Powered Generation', content: 'AI Commit analyzes git diff and generates conventional commit messages via AI models.\n\n**Core Capabilities:**\n- Auto-analyze staged or unstaged diff\n- Generate 1-5 candidate messages\n- Auto-truncate large diffs with 3 options\n- Auto-detect change scope\n- Project context enhancement\n\n**Example:**\n```\nInput: git diff --cached\nOutput:\nfeat(auth): add user login:\n- Implement JWT auth;\n- Add form validation;\n- Integrate OAuth login.\n```' },
  openai: { title: 'OpenAI Compatible', content: 'Works with all OpenAI Chat Completions API-compatible providers.\n\n**Supported Providers:**\n- OpenAI (gpt-4, gpt-4o)\n- DeepSeek (deepseek-chat)\n- Qwen (qwen-turbo, qwen-plus)\n- Moonshot (moonshot-v1-8k)\n- GLM (glm-4)\n- Local Ollama (llama3)\n\nJust enter the Base URL and model name.' },
  streaming: { title: 'SSE Streaming', content: 'With streaming enabled, AI results appear progressively, first token in < 1 second.\n\n**How it works:**\n- Sends `stream: true` parameter\n- Real-time SSE event parsing\n- Supports `stream_options.include_usage`\n\n**Config:**\n- `aicommit.enableStreaming`: default on\n- Disable to wait for complete response' },
  templates: { title: '7 Prompt Templates', content: '7 built-in prompt templates for different scenarios.\n\n1. **Bullet** (default) — bullet-point style\n2. **Conventional Expert** — standard Conventional Commits\n3. **Concise** — minimal style\n4. **Detailed** — verbose with motivation and risk\n5. **Semantic** — structured XML format\n6. **Team** — team collaboration style\n7. **Custom** — custom template\n\nConfig: `aicommit.promptTemplate`' },
  groups: { title: 'Model Groups', content: 'Create multiple AI configurations and switch with one click.\n\n**Features:**\n- Independent settings per group\n- API Keys encrypted in SecretStorage\n- Real-time status bar indicator\n- Full CRUD: add, edit, delete\n\n**Config:**\n- `aicommit.modelGroups`: group list\n- `aicommit.activeModelGroup`: active group' },
  usage: { title: 'Usage Statistics', content: 'Comprehensive token usage tracking and cost management.\n\n**Metrics:**\n- Today/Week/Month token usage\n- 14-day usage trend chart\n- Daily average, total calls, daily cost\n\n**Budget Management:**\n- Daily/Monthly budget alerts (80%/100%)\n- Multi-currency (USD/CNY)\n- Custom model pricing\n- Export as JSON/CSV' },
  proxy: { title: 'Proxy Support', content: 'Native proxy implementation, no extra dependencies.\n\n**Supported Protocols:**\n- HTTP/HTTPS: `http://proxy:8080`\n- SOCKS5: `socks5://proxy:1080`\n- Auth: `http://user:pass@proxy:8080`\n\n**Environment Fallback:**\n- HTTP_PROXY / HTTPS_PROXY / ALL_PROXY\n\nConfig: `aicommit.proxy`' },
  project: { title: 'Project Config', content: 'Override user-level settings with project-level config.\n\n**.aicommitrc.json:**\n```json\n{\n  "model": "deepseek-chat",\n  "temperature": 0.5,\n  "format": "bullet"\n}\n```\n\n**.aicommitignore:**\nExclude files from analysis, same format as .gitignore.\n\nFile watching with auto-reload.' },
  security: { title: 'Secure Keys', content: 'Secure API Key storage solution.\n\n**Security:**\n- Stored in VSCode SecretStorage, not settings.json\n- Settings Sync compatible\n- Auto-prompt when key is empty\n- Independent key management per group\n- Auto-migration on rename' },
}

const iconMap: Record<string, string> = {
  ai: 'icon-robot',
  openai: 'icon-plug',
  streaming: 'icon-bolt',
  templates: 'icon-palette',
  groups: 'icon-tag',
  usage: 'icon-chart',
  proxy: 'icon-globe',
  project: 'icon-folder',
  security: 'icon-lock',
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
      { name: 'Custom', example: '[feat] 添加用户登录功能\n\n自定义格式模板，支持占位符替换:\n<type>(<scope>): <description>', desc: '自定义格式模板' },
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
  { name: 'OpenAI', nameEn: 'OpenAI', url: 'api.openai.com/v1', models: 'gpt-4, gpt-4o', logo: 'https://cdn.auth0.com/avatars/ai.png', bg: '#10b981' },
  { name: 'DeepSeek', nameEn: 'DeepSeek', url: 'api.deepseek.com/v1', models: 'deepseek-chat', logo: 'https://cdn.auth0.com/avatars/ds.png', bg: '#0078d4' },
  { name: '通义千问', nameEn: 'Qwen', url: 'dashscope.aliyuncs.com', models: 'qwen-turbo, qwen-plus', logo: 'https://cdn.auth0.com/avatars/qw.png', bg: '#6c5ce7' },
  { name: 'Moonshot', nameEn: 'Moonshot', url: 'api.moonshot.cn/v1', models: 'moonshot-v1-8k', logo: 'https://cdn.auth0.com/avatars/mo.png', bg: '#f59e0b' },
  { name: '智谱 AI', nameEn: 'GLM', url: 'open.bigmodel.cn', models: 'glm-4, glm-4-flash', logo: 'https://cdn.auth0.com/avatars/gl.png', bg: '#ef4444' },
  { name: 'Ollama', nameEn: 'Ollama', url: 'localhost:11434/v1', models: 'llama3, qwen2', logo: 'https://cdn.auth0.com/avatars/ol.png', bg: '#8b5cf6' },
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

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <img src={src} alt={alt} />
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
        return <p key={`${i}-${j}`}>{line}</p>
      })
    })
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
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

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'dark' ? 'light' : 'dark'), [])

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
            <li><a href="#providers">{t.nav.providers}</a></li>
            <li><a href="#screenshots">{t.nav.screenshots}</a></li>
            <li><a href="#install">{t.nav.install}</a></li>
            <li><a href="#faq">{t.nav.faq}</a></li>
            <li>
              <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? (lang === 'zh' ? '切换亮色' : 'Light mode') : (lang === 'zh' ? '切换暗色' : 'Dark mode')}>
                <i className={theme === 'dark' ? 'icon-sun' : 'icon-moon'} />
              </button>
            </li>
            <li>
              <button className="lang-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
                {lang === 'zh' ? 'EN' : '中文'}
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
          <div className="hero-badge"><i className="icon-star" /> {t.hero.star}</div>
          <h1>AI Commit</h1>
          <p className="hero-tagline">{t.hero.tagline}</p>
          <p className="hero-desc">{t.hero.desc}</p>
          <div className="hero-buttons">
            <a href="https://github.com/Vogadero/AiCommit/releases/latest" className="btn-primary" target="_blank" rel="noopener noreferrer">
              <i className="icon-download" /> {t.hero.download}
            </a>
            <a href="https://github.com/Vogadero/AiCommit" className="btn-secondary" target="_blank" rel="noopener noreferrer">
              <i className="icon-github" /> {t.hero.github}
            </a>
          </div>
        </div>
        <div className="hero-scroll-hint">
          <i className="icon-chevron-down" />
        </div>
      </section>

      <section id="features">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.features.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.features.subtitle}</p></FadeIn>
          <div className="features-grid">
            {t.features.list.map((f, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="feature-card" onClick={() => setFeatureDetail(details[f.key])} role="button" tabIndex={0}>
                  <div className="feature-icon"><i className={iconMap[f.key]} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <span className="feature-arrow"><i className="icon-arrow-right" /></span>
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
                    <img src={p.logo} alt={p.nameEn} className="provider-logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="provider-logo-fallback">{p.nameEn.charAt(0)}</span>
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
                    <div className="screenshot-zoom"><i className="icon-zoom" /></div>
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
                    <i className={`faq-chevron icon-chevron-down`} />
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
