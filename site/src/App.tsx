import { useState } from 'react'
import './styles/global.css'

const features = [
  { icon: '🤖', title: 'AI 驱动生成', desc: '基于 git diff 自动分析变更，生成规范的 commit 信息，支持多候选方案 QuickPick 选择' },
  { icon: '🔌', title: 'OpenAI 兼容', desc: '支持所有 OpenAI 兼容 API：DeepSeek、通义千问、Moonshot、智谱 AI 等' },
  { icon: '⚡', title: 'SSE 流式响应', desc: '请求发送 stream:true，实时解析 SSE 事件流，首字显示 < 1 秒' },
  { icon: '🎨', title: '多种提交风格', desc: 'Conventional Commits、Gitmoji、Bullet 要点式、自定义 Prompt 模板' },
  { icon: '🏷️', title: '模型配置组', desc: '多组 AI 配置一键切换，API Key 加密存储在 SecretStorage' },
  { icon: '📊', title: '用量统计', desc: 'Token 追踪、费用计算、预算告警、14 天趋势图、多币种支持' },
  { icon: '🌐', title: '代理支持', desc: 'HTTP/HTTPS/SOCKS5 代理，原生实现无需额外依赖，环境变量自动回退' },
  { icon: '📁', title: '项目级配置', desc: '.aicommitrc.json 项目级覆盖，.aicommitignore 文件过滤' },
  { icon: '🔐', title: '密钥安全', desc: 'API Key 存储在 VSCode SecretStorage，支持 Settings Sync' },
]

const providers = [
  { name: 'OpenAI', url: 'api.openai.com/v1', models: 'gpt-4, gpt-4o' },
  { name: 'DeepSeek', url: 'api.deepseek.com/v1', models: 'deepseek-chat' },
  { name: '通义千问', url: 'dashscope.aliyuncs.com', models: 'qwen-turbo, qwen-plus' },
  { name: 'Moonshot', url: 'api.moonshot.cn/v1', models: 'moonshot-v1-8k' },
  { name: '智谱 AI', url: 'open.bigmodel.cn', models: 'glm-4, glm-4-flash' },
]

const screenshots = [
  { id: 'config', title: '配置面板', placeholder: '配置面板截图 — 请将截图放入 public/images/ 目录' },
  { id: 'generate', title: '生成 Commit', placeholder: '生成 Commit 截图 — 请将截图放入 public/images/ 目录' },
  { id: 'usage', title: '用量统计', placeholder: '用量统计截图 — 请将截图放入 public/images/ 目录' },
]

const configs = [
  { key: 'aicommit.apiKey', desc: 'API 密钥（加密存储）', default: '-' },
  { key: 'aicommit.model', desc: 'AI 模型名称', default: 'gpt-4' },
  { key: 'aicommit.baseUrl', desc: 'API 基础 URL', default: 'openai.com/v1' },
  { key: 'aicommit.commitStyle', desc: '提交风格', default: 'conventional' },
  { key: 'aicommit.enableStreaming', desc: 'SSE 流式响应', default: 'true' },
  { key: 'aicommit.proxy', desc: '代理地址', default: '-' },
  { key: 'aicommit.dailyBudget', desc: '日预算', default: '0' },
  { key: 'aicommit.currency', desc: '货币单位', default: 'USD' },
]

function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src="/AiCommit/images/icon.png" alt="AI Commit" />
            AI Commit
          </a>
          <ul className="nav-links">
            <li><a href="#features">{lang === 'zh' ? '功能' : 'Features'}</a></li>
            <li><a href="#providers">{lang === 'zh' ? '服务商' : 'Providers'}</a></li>
            <li><a href="#screenshots">{lang === 'zh' ? '截图' : 'Screenshots'}</a></li>
            <li><a href="#install">{lang === 'zh' ? '安装' : 'Install'}</a></li>
            <li><a href="#config">{lang === 'zh' ? '配置' : 'Config'}</a></li>
            <li>
              <button
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-dim)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {lang === 'zh' ? 'EN' : '中文'}
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <section className="hero" id="hero">
        <img src="/AiCommit/images/icon.png" alt="AI Commit" className="hero-logo" />
        <h1>AI Commit</h1>
        <p>
          {lang === 'zh'
            ? '通过 AI 大模型自动生成规范的 Git Commit 信息，支持 OpenAI 兼容协议'
            : 'Auto-generate conventional Git commit messages with AI, supporting OpenAI-compatible APIs'}
        </p>
        <div className="hero-buttons">
          <a
            href="https://github.com/Vogadero/AiCommit/releases/latest"
            className="btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇ {lang === 'zh' ? '下载安装' : 'Download'}
          </a>
          <a
            href="https://github.com/Vogadero/AiCommit"
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            ⭐ GitHub
          </a>
        </div>
      </section>

      <section id="features">
        <div className="container">
          <h2 className="section-title">
            {lang === 'zh' ? '✨ 功能特性' : '✨ Features'}
          </h2>
          <p className="section-subtitle">
            {lang === 'zh'
              ? '为 Git 工作流而生的 AI 助手'
              : 'An AI assistant built for Git workflows'}
          </p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="providers" style={{ background: 'var(--gradient-hero)' }}>
        <div className="container">
          <h2 className="section-title">
            {lang === 'zh' ? '🌐 支持的 AI 服务商' : '🌐 Supported AI Providers'}
          </h2>
          <p className="section-subtitle">
            {lang === 'zh'
              ? '任何兼容 OpenAI API 协议的服务均可使用'
              : 'Works with any OpenAI API-compatible service'}
          </p>
          <div className="providers-grid">
            {providers.map((p, i) => (
              <div className="provider-card" key={i}>
                <h4>{p.name}</h4>
                <code>{p.url}</code>
                <br />
                <small style={{ color: 'var(--text-dim)' }}>{p.models}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="screenshots" className="screenshots">
        <div className="container">
          <h2 className="section-title">
            {lang === 'zh' ? '📸 界面截图' : '📸 Screenshots'}
          </h2>
          <p className="section-subtitle">
            {lang === 'zh'
              ? '直观的配置面板与用量统计'
              : 'Intuitive config panel and usage statistics'}
          </p>
          <div className="screenshots-grid">
            {screenshots.map((s, i) => (
              <div className="screenshot-card" key={i}>
                <img
                  src={`/AiCommit/images/screenshot-${s.id}.png`}
                  alt={s.title}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.style.cssText = 'height:200px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.85rem;padding:16px;text-align:center;';
                      placeholder.textContent = s.placeholder;
                      parent.insertBefore(placeholder, img);
                    }
                  }}
                />
                <div className="caption">{s.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="install">
        <div className="container">
          <h2 className="section-title">
            {lang === 'zh' ? '🚀 快速开始' : '🚀 Quick Start'}
          </h2>
          <p className="section-subtitle">
            {lang === 'zh' ? '三步即可开始使用' : 'Get started in three steps'}
          </p>
          <div className="install-steps">
            <div className="install-step">
              <div className="step-num">1</div>
              <h4>{lang === 'zh' ? '安装扩展' : 'Install Extension'}</h4>
              <p>
                {lang === 'zh'
                  ? '从 GitHub Releases 下载 .vsix 文件，或通过 VSCode 扩展市场安装'
                  : 'Download .vsix from GitHub Releases, or install via VSCode Marketplace'}
              </p>
            </div>
            <div className="install-step">
              <div className="step-num">2</div>
              <h4>{lang === 'zh' ? '配置 API' : 'Configure API'}</h4>
              <p>
                {lang === 'zh'
                  ? '打开配置面板，填入 API Key、Base URL 和模型名称'
                  : 'Open config panel, enter API Key, Base URL, and model name'}
              </p>
            </div>
            <div className="install-step">
              <div className="step-num">3</div>
              <h4>{lang === 'zh' ? '生成 Commit' : 'Generate Commit'}</h4>
              <p>
                {lang === 'zh'
                  ? '在源代码管理面板点击 ✨ 图标，选择满意的 commit 信息'
                  : 'Click ✨ icon in Source Control, pick your preferred commit message'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="config" style={{ background: 'var(--gradient-hero)' }}>
        <div className="container">
          <h2 className="section-title">
            {lang === 'zh' ? '⚙️ 配置项' : '⚙️ Configuration'}
          </h2>
          <p className="section-subtitle">
            {lang === 'zh' ? '灵活的配置满足不同需求' : 'Flexible settings for different needs'}
          </p>
          <table className="config-table">
            <thead>
              <tr>
                <th>{lang === 'zh' ? '配置项' : 'Setting'}</th>
                <th>{lang === 'zh' ? '说明' : 'Description'}</th>
                <th>{lang === 'zh' ? '默认值' : 'Default'}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c, i) => (
                <tr key={i}>
                  <td><code>{c.key}</code></td>
                  <td>{c.desc}</td>
                  <td><code>{c.default}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>
            MIT License &copy; 2025 <a href="https://github.com/Vogadero" target="_blank" rel="noopener noreferrer">Vogadero</a>
            {' | '}
            <a href="https://github.com/Vogadero/AiCommit" target="_blank" rel="noopener noreferrer">GitHub</a>
            {' | '}
            <a href="https://github.com/Vogadero/AiCommit/releases" target="_blank" rel="noopener noreferrer">Releases</a>
          </p>
        </div>
      </footer>
    </>
  )
}

export default App
