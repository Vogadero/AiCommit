import { useState, useEffect, useRef } from 'react'
import './styles/global.css'

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
      { icon: '🤖', title: 'AI 驱动生成', desc: '基于 git diff 自动分析变更，生成规范的 commit 信息，支持多候选方案 QuickPick 选择' },
      { icon: '🔌', title: 'OpenAI 兼容', desc: '支持所有 OpenAI 兼容 API：DeepSeek、通义千问、Moonshot、智谱 AI 等，即配即用' },
      { icon: '⚡', title: 'SSE 流式响应', desc: '实时解析 SSE 事件流，首字显示 < 1 秒，显著改善等待体验' },
      { icon: '🎨', title: '7 种 Prompt 模板', desc: 'Bullet、Conventional、Concise、Detailed、Semantic、Team、自定义模板' },
      { icon: '🏷️', title: '模型配置组', desc: '多组 AI 配置一键切换，API Key 加密存储在 VSCode SecretStorage' },
      { icon: '📊', title: '用量统计', desc: 'Token 追踪、费用计算、预算告警、14 天趋势图、多币种支持' },
      { icon: '🌐', title: '代理支持', desc: 'HTTP/HTTPS/SOCKS5 代理，原生实现无需额外依赖，环境变量自动回退' },
      { icon: '📁', title: '项目级配置', desc: '.aicommitrc.json 项目级覆盖，.aicommitignore 文件过滤' },
      { icon: '🔐', title: '密钥安全', desc: 'API Key 存储在 VSCode SecretStorage，支持 Settings Sync 同步' },
    ],
  },
  howItWorks: {
    title: '工作流程',
    subtitle: '三步即可开始使用',
    steps: [
      { num: '1', title: '安装扩展', desc: '从 GitHub Releases 下载 .vsix 文件，或通过 VSCode 扩展市场安装' },
      { num: '2', title: '配置 API', desc: '打开配置面板，填入 API Key、Base URL 和模型名称，点击测试连接验证' },
      { num: '3', title: '生成 Commit', desc: '在源代码管理面板点击 ✨ 图标，选择满意的 commit 信息即可提交' },
    ],
  },
  providers: {
    title: '支持的 AI 服务商',
    subtitle: '任何兼容 OpenAI API 协议的服务均可使用',
    list: [
      { name: 'OpenAI', url: 'api.openai.com/v1', models: 'gpt-4, gpt-4o', color: '#10b981' },
      { name: 'DeepSeek', url: 'api.deepseek.com/v1', models: 'deepseek-chat', color: '#0078d4' },
      { name: '通义千问', url: 'dashscope.aliyuncs.com', models: 'qwen-turbo, qwen-plus', color: '#6c5ce7' },
      { name: 'Moonshot', url: 'api.moonshot.cn/v1', models: 'moonshot-v1-8k', color: '#f59e0b' },
      { name: '智谱 AI', url: 'open.bigmodel.cn', models: 'glm-4, glm-4-flash', color: '#ef4444' },
      { name: 'Ollama', url: 'localhost:11434/v1', models: 'llama3, qwen2', color: '#8b5cf6' },
    ],
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
      { name: 'Gitmoji', example: '✨ auth: add JWT-based user login', desc: '语义化 Emoji 前缀' },
      { name: 'Bullet', example: 'feat(auth): 添加登录功能:\n- 实现 JWT 认证;\n- 添加表单验证。', desc: 'AI Commit 内置要点式风格' },
      { name: 'Custom', example: '[feat] 添加用户登录功能', desc: '自定义格式模板' },
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
      { icon: '🤖', title: 'AI-Powered Generation', desc: 'Analyze git diff to auto-generate conventional commit messages with multiple QuickPick candidates' },
      { icon: '🔌', title: 'OpenAI Compatible', desc: 'Works with all OpenAI-compatible APIs: DeepSeek, Qwen, Moonshot, GLM, and more' },
      { icon: '⚡', title: 'SSE Streaming', desc: 'Real-time SSE event parsing, first token in < 1 second for a smooth experience' },
      { icon: '🎨', title: '7 Prompt Templates', desc: 'Bullet, Conventional, Concise, Detailed, Semantic, Team, and Custom templates' },
      { icon: '🏷️', title: 'Model Groups', desc: 'One-click switching between multiple AI configs, API Keys encrypted in SecretStorage' },
      { icon: '📊', title: 'Usage Statistics', desc: 'Token tracking, cost calculation, budget alerts, 14-day trends, multi-currency support' },
      { icon: '🌐', title: 'Proxy Support', desc: 'HTTP/HTTPS/SOCKS5 proxy, native implementation, environment variable fallback' },
      { icon: '📁', title: 'Project Config', desc: '.aicommitrc.json project-level overrides, .aicommitignore file filtering' },
      { icon: '🔐', title: 'Secure Keys', desc: 'API Keys stored in VSCode SecretStorage, Settings Sync compatible' },
    ],
  },
  howItWorks: {
    title: 'How It Works',
    subtitle: 'Get started in three steps',
    steps: [
      { num: '1', title: 'Install Extension', desc: 'Download .vsix from GitHub Releases, or install via VSCode Marketplace' },
      { num: '2', title: 'Configure API', desc: 'Open config panel, enter API Key, Base URL, and model name, then test connection' },
      { num: '3', title: 'Generate Commit', desc: 'Click ✨ icon in Source Control panel, pick your preferred commit message' },
    ],
  },
  providers: {
    title: 'Supported AI Providers',
    subtitle: 'Works with any OpenAI API-compatible service',
    list: [
      { name: 'OpenAI', url: 'api.openai.com/v1', models: 'gpt-4, gpt-4o', color: '#10b981' },
      { name: 'DeepSeek', url: 'api.deepseek.com/v1', models: 'deepseek-chat', color: '#0078d4' },
      { name: 'Qwen', url: 'dashscope.aliyuncs.com', models: 'qwen-turbo, qwen-plus', color: '#6c5ce7' },
      { name: 'Moonshot', url: 'api.moonshot.cn/v1', models: 'moonshot-v1-8k', color: '#f59e0b' },
      { name: 'GLM', url: 'open.bigmodel.cn', models: 'glm-4, glm-4-flash', color: '#ef4444' },
      { name: 'Ollama', url: 'localhost:11434/v1', models: 'llama3, qwen2', color: '#8b5cf6' },
    ],
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
      { name: 'Gitmoji', example: '✨ auth: add JWT-based user login', desc: 'Semantic Emoji prefix' },
      { name: 'Bullet', example: 'feat(auth): add user login:\n- Implement JWT auth;\n- Add form validation.', desc: 'AI Commit built-in bullet style' },
      { name: 'Custom', example: '[feat] Add user login feature', desc: 'Custom format template' },
    ],
  },
  faq: {
    title: 'FAQ',
    list: [
      { q: 'Which AI providers are supported?', a: 'Any provider compatible with the OpenAI Chat Completions API protocol, including OpenAI, DeepSeek, Qwen, Moonshot, GLM, and local Ollama. Just enter the Base URL and model name.' },
      { q: 'Is my API Key secure?', a: 'API Keys are encrypted using VSCode\'s built-in SecretStorage and are never stored in plain text in settings.json. Settings Sync is also supported with auto-prompt for re-entry.' },
      { q: 'How to use a proxy?', a: 'Enter the proxy address in settings. HTTP/HTTPS/SOCKS5 protocols are supported, including authenticated proxies. Leave empty to disable, or use HTTP_PROXY / HTTPS_PROXY / ALL_PROXY environment variables.' },
      { q: 'How is token usage billed?', a: 'AI Commit automatically calculates costs based on each model\'s official pricing. Custom model pricing is supported. USD/CNY dual currency with configurable exchange rate.' },
      { q: 'Can I use it in team projects?', a: 'Yes. Through .aicommitrc.json project-level config, team members can share model and style settings while managing their own API Keys independently.' },
    ],
  },
  footer: {
    slogan: 'Make every commit clear and conventional',
    license: 'MIT License',
    copyright: '© 2025 Vogadero',
  },
}

function useInView(threshold = 0.15) {
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
    <div
      ref={ref}
      className={`fade-in ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const t = lang === 'zh' ? zh : en

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
              <button className="lang-btn" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
                {lang === 'zh' ? 'EN' : '中文'}
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="hero-bg-grid" />
        <div className="hero-content">
          <img src="/AiCommit/images/icon.png" alt="AI Commit" className="hero-logo" />
          <div className="hero-badge">{t.hero.star}</div>
          <h1>AI Commit</h1>
          <p className="hero-tagline">{t.hero.tagline}</p>
          <p className="hero-desc">{t.hero.desc}</p>
          <div className="hero-buttons">
            <a href="https://github.com/Vogadero/AiCommit/releases/latest" className="btn-primary" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {t.hero.download}
            </a>
            <a href="https://github.com/Vogadero/AiCommit" className="btn-secondary" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              {t.hero.github}
            </a>
          </div>
        </div>
        <div className="hero-scroll-hint">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </section>

      <section id="features">
        <div className="container">
          <FadeIn><h2 className="section-title">{t.features.title}</h2></FadeIn>
          <FadeIn><p className="section-subtitle">{t.features.subtitle}</p></FadeIn>
          <div className="features-grid">
            {t.features.list.map((f, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
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
              <FadeIn key={i} delay={i * 120}>
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
              <FadeIn key={i} delay={i * 80}>
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
            {t.providers.list.map((p, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="provider-card">
                  <div className="provider-dot" style={{ background: p.color }} />
                  <h4>{p.name}</h4>
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
              <FadeIn key={i} delay={i * 80}>
                <div className="screenshot-card">
                  <div className="screenshot-img-wrap">
                    <img
                      src={`/AiCommit/images/screenshot-${s.id}.png`}
                      alt={s.title}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                        const parent = img.parentElement
                        if (parent && !parent.querySelector('.screenshot-placeholder')) {
                          const placeholder = document.createElement('div')
                          placeholder.className = 'screenshot-placeholder'
                          placeholder.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>${s.title}</span>`
                          parent.insertBefore(placeholder, img)
                        }
                      }}
                    />
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
              <FadeIn key={i} delay={i * 60}>
                <div className={`faq-item ${faqOpen === i ? 'open' : ''}`} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <div className="faq-question">
                    <span>{item.q}</span>
                    <svg className="faq-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
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
    </>
  )
}

export default App
