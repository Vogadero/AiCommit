import * as https from 'https';
import * as http from 'http';
import * as net from 'net';
import { URL } from 'url';
import { Logger } from '../utils';
import { AiCommitError, ErrorCode, classifyHttpError } from '../utils';
import { AiCommitConfig } from '../config';
import { CommitCandidate, AiGenerateResult } from './promptBuilder';
import { ResponsePipeline } from './responsePipeline';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
}

interface ChatCompletionChoice {
  message: {
    content: string;
  };
}

interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

export interface TokenUsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

interface ModelItem {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface ModelsResponse {
  object: string;
  data: ModelItem[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  modelInfo?: {
    id: string;
    owned_by?: string;
  };
  latency?: number;
}

export class AiService {
  private currentAbortController: AbortController | null = null;
  private pipeline: ResponsePipeline;

  constructor(private logger: Logger) {
    this.pipeline = new ResponsePipeline(logger);
  }

  cancel(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      this.logger.info('已取消 AI 请求');
    }
  }

  async testConnection(config: AiCommitConfig): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      const url = buildApiUrl(config.baseUrl, 'models');
      const rawResponse = await this.makeRequest(
        url,
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        '',
        15000,
        'GET',
        undefined,
        config.proxy,
      );

      const latency = Date.now() - startTime;

      if (!rawResponse) {
        return {
          success: false,
          message: '服务器返回空响应',
          latency,
        };
      }

      let modelsResponse: ModelsResponse;
      try {
        modelsResponse = JSON.parse(rawResponse);
      } catch {
        return {
          success: true,
          message: `连接成功（${latency}ms），但无法解析模型列表`,
          latency,
        };
      }

      const models = modelsResponse.data || [];
      const targetModel = models.find((m: ModelItem) => m.id === config.model);

      if (targetModel) {
        return {
          success: true,
          message: `连接成功（${latency}ms）✓ 模型 "${config.model}" 可用，提供方: ${targetModel.owned_by || '未知'}`,
          modelInfo: { id: targetModel.id, owned_by: targetModel.owned_by },
          latency,
        };
      }

      if (models.length > 0) {
        const availableIds = models.slice(0, 10).map((m: ModelItem) => m.id).join(', ');
        return {
          success: true,
          message: `连接成功（${latency}ms）⚠ 模型 "${config.model}" 未在列表中找到。可用模型: ${availableIds}${models.length > 10 ? ` ...等 ${models.length} 个` : ''}`,
          latency,
        };
      }

      return {
        success: true,
        message: `连接成功（${latency}ms），模型列表为空`,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      if (error instanceof AiCommitError) {
        return {
          success: false,
          message: `连接失败（${latency}ms）: ${getUserMessage(error)}`,
          latency,
        };
      }
      return {
        success: false,
        message: `连接失败（${latency}ms）: ${(error as Error).message}`,
        latency,
      };
    }
  }

  async fetchModels(config: AiCommitConfig): Promise<ModelItem[]> {
    try {
      const url = buildApiUrl(config.baseUrl, 'models');
      const rawResponse = await this.makeRequest(
        url,
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        '',
        15000,
        'GET',
        undefined,
        config.proxy,
      );

      if (!rawResponse) {
        return [];
      }

      const modelsResponse: ModelsResponse = JSON.parse(rawResponse);
      return (modelsResponse.data || []).sort((a: ModelItem, b: ModelItem) => a.id.localeCompare(b.id));
    } catch (error) {
      this.logger.error(`获取模型列表失败: ${(error as Error).message}`);
      return [];
    }
  }

  async generate(
    config: AiCommitConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AiGenerateResult> {
    this.cancel();
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      const useStream = config.enableStreaming;
      const body: ChatCompletionRequest & { stream?: boolean; stream_options?: { include_usage: boolean } } = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      };

      if (useStream) {
        body.stream = true;
        body.stream_options = { include_usage: true };
      }

      const url = buildApiUrl(config.baseUrl, 'chat/completions');

      let rawResponse: string;
      if (useStream) {
        rawResponse = await this.makeStreamRequest(
          url,
          {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          JSON.stringify(body),
          60000,
          abortController.signal,
          config.proxy,
        );
      } else {
        rawResponse = await this.makeRequest(
          url,
          {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          JSON.stringify(body),
          60000,
          'POST',
          abortController.signal,
          config.proxy,
        );
      }

      this.currentAbortController = null;

      if (!rawResponse) {
        throw new AiCommitError(ErrorCode.AI_RESPONSE_EMPTY, 'AI 返回空响应');
      }

      const { content, usage } = this.parseResponseWithUsage(rawResponse);
      const pipelineResult = this.pipeline.process(content, config);

      if (pipelineResult.warnings.length > 0) {
        this.logger.warn(`后处理管线警告: ${pipelineResult.warnings.join('; ')}`);
      }

      const candidates = pipelineResult.candidates
        .map(candidateText => this.parseSingleCandidate(candidateText, config))
        .filter((c): c is CommitCandidate => c !== null);

      if (candidates.length === 0) {
        throw new AiCommitError(
          ErrorCode.AI_RESPONSE_PARSE_ERROR,
          '无法解析 AI 返回的 commit 信息',
          content,
        );
      }

      let tokenUsage: TokenUsageInfo | undefined;
      if (usage) {
        tokenUsage = {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
        };
      }

      return { candidates, rawResponse: content, tokenUsage };
    } catch (error) {
      this.currentAbortController = null;
      if (error instanceof AiCommitError) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new AiCommitError(ErrorCode.CANCELLED, '已取消生成');
      }
      throw error;
    }
  }

  private parseResponse(raw: string): string {
    try {
      const response = JSON.parse(raw) as ChatCompletionResponse;
      if (response.choices && response.choices.length > 0 && response.choices[0].message) {
        return response.choices[0].message.content || '';
      }
      return '';
    } catch {
      return raw;
    }
  }

  private parseResponseWithUsage(raw: string): { content: string; usage: ChatCompletionResponse['usage'] } {
    try {
      const response = JSON.parse(raw) as ChatCompletionResponse;
      const content = (response.choices && response.choices.length > 0 && response.choices[0].message)
        ? (response.choices[0].message.content || '')
        : '';
      return { content, usage: response.usage };
    } catch {
      return { content: raw, usage: undefined };
    }
  }

  private parseSingleCandidate(text: string, config: AiCommitConfig): CommitCandidate | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const lines = trimmed.split('\n');
    const firstLine = lines[0];
    const body = lines.slice(1).join('\n').trim();

    const parsed = this.parseCommitLine(firstLine, config);

    return {
      message: trimmed,
      type: parsed.type,
      scope: parsed.scope,
      description: parsed.description,
      body,
    };
  }

  private parseCommitLine(
    line: string,
    config: AiCommitConfig,
  ): { type: string; scope: string; description: string } {
    switch (config.format) {
      case 'conventional': {
        const match = line.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/);
        if (match) {
          return { type: match[1], scope: match[2] || '', description: match[3] };
        }
        return { type: '', scope: '', description: line };
      }
      case 'gitmoji': {
        const match = line.match(/^[^\w\s]*\s*(\w+)(?:\(([^)]+)\))?:\s*(.+)/);
        if (match) {
          return { type: match[1], scope: match[2] || '', description: match[3] };
        }
        return { type: '', scope: '', description: line };
      }
      default:
        return { type: '', scope: '', description: line };
    }
  }

  private makeRequest(
    url: string,
    headers: Record<string, string>,
    body: string,
    timeout: number,
    method: 'GET' | 'POST' = 'POST',
    signal?: AbortSignal,
    proxy?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';

      const proxyUrl = proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy;

      const reqHeaders: Record<string, string> = { ...headers };
      if (body && method === 'POST') {
        reqHeaders['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const sendOverSocket = (socket: net.Socket) => {
        const agent = isHttps
          ? new https.Agent({ rejectUnauthorized: false })
          : new http.Agent();
        (agent as any).socket = socket;

        const actualOptions: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: reqHeaders,
          agent,
        };

        const lib = isHttps ? https : http;
        const req = lib.request(actualOptions, (response) => {
          this.handleResponse(response, resolve, reject);
        });

        this.attachErrorHandlers(req, reject, signal, timeout, true);
        if (body && method === 'POST') {
          req.write(body);
        }
        req.end();
      };

      if (proxyUrl) {
        try {
          const parsedProxy = new URL(proxyUrl);
          const isSocks = parsedProxy.protocol === 'socks5:' || parsedProxy.protocol === 'socks5h:' || parsedProxy.protocol === 'socks:';
          this.logger.debug(`使用代理: ${parsedProxy.protocol}//${parsedProxy.hostname}:${parsedProxy.port}`);

          if (isSocks) {
            this.connectSocks5(
              parsedProxy.hostname,
              parseInt(parsedProxy.port || '1080', 10),
              parsedProxy.username,
              parsedProxy.password,
              parsedUrl.hostname,
              parseInt(parsedUrl.port || (isHttps ? '443' : '80'), 10),
              10000,
            ).then(socket => {
              sendOverSocket(socket);
            }).catch(err => {
              reject(err instanceof AiCommitError ? err : new AiCommitError(ErrorCode.NETWORK_ERROR, `SOCKS5 代理连接失败: ${err.message}`));
            });
            return;
          }

          const options: http.RequestOptions = {
            hostname: parsedProxy.hostname,
            port: parsedProxy.port || (parsedProxy.protocol === 'https:' ? 443 : 80),
            path: url,
            method: 'CONNECT',
            headers: {},
          };

          if (parsedProxy.username || parsedProxy.password) {
            const auth = Buffer.from(`${parsedProxy.username}:${parsedProxy.password}`).toString('base64');
            (options.headers as Record<string, string>)['Proxy-Authorization'] = `Basic ${auth}`;
          }

          const connectReq = http.request(options);

          connectReq.on('connect', (res, socket) => {
            if (res.statusCode !== 200) {
              reject(new AiCommitError(ErrorCode.NETWORK_ERROR, `代理连接失败: ${res.statusCode}`));
              return;
            }
            sendOverSocket(socket);
          });

          connectReq.on('error', (err: Error) => {
            this.logger.error(`代理连接错误: ${err.message}`);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, `代理连接失败，请检查代理配置: ${err.message}`));
          });

          connectReq.setTimeout(10000, () => {
            connectReq.destroy();
            reject(new AiCommitError(ErrorCode.NETWORK_TIMEOUT, '代理连接超时'));
          });

          connectReq.end();
          return;
        } catch (e) {
          this.logger.warn(`代理配置解析失败: ${(e as Error).message}，回退到直连`);
        }
      }

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: reqHeaders,
      };

      const lib = isHttps ? https : http;
      const req = lib.request(options, (res) => {
        this.handleResponse(res, resolve, reject);
      });

      this.attachErrorHandlers(req, reject, signal, timeout, false);
      if (body && method === 'POST') {
        req.write(body);
      }
      req.end();
    });
  }

  private async connectSocks5(
    proxyHost: string,
    proxyPort: number,
    username: string | undefined,
    password: string | undefined,
    targetHost: string,
    targetPort: number,
    connectTimeout: number,
  ): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new AiCommitError(ErrorCode.NETWORK_TIMEOUT, 'SOCKS5 代理连接超时'));
      }, connectTimeout);

      socket.connect(proxyPort, proxyHost, () => {
        const hasAuth = !!username || !!password;
        const authMethod = hasAuth ? 0x02 : 0x00;
        const greeting = Buffer.from([0x05, 0x01, authMethod]);
        socket.write(greeting);
      });

      let step = 'greeting';

      socket.on('data', (data: Buffer) => {
        if (step === 'greeting') {
          if (data.length < 2 || data[0] !== 0x05) {
            cleanup();
            clearTimeout(timer);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, 'SOCKS5 代理返回无效响应'));
            return;
          }
          const method = data[1];
          if (method === 0xFF) {
            cleanup();
            clearTimeout(timer);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, 'SOCKS5 代理不支持认证方式'));
            return;
          }
          if (method === 0x02) {
            const user = (username || '').substring(0, 255);
            const pass = (password || '').substring(0, 255);
            const authBuf = Buffer.alloc(3 + user.length + pass.length);
            authBuf[0] = 0x01;
            authBuf[1] = user.length;
            authBuf.write(user, 2);
            authBuf[2 + user.length] = pass.length;
            authBuf.write(pass, 3 + user.length);
            socket.write(authBuf);
            step = 'auth';
          } else {
            this.sendSocks5Connect(socket, targetHost, targetPort);
            step = 'connect';
          }
        } else if (step === 'auth') {
          if (data.length < 2 || data[1] !== 0x00) {
            cleanup();
            clearTimeout(timer);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, 'SOCKS5 代理认证失败'));
            return;
          }
          this.sendSocks5Connect(socket, targetHost, targetPort);
          step = 'connect';
        } else if (step === 'connect') {
          if (data.length < 4 || data[1] !== 0x00) {
            const errCodes: Record<number, string> = {
              0x01: 'SOCKS5 服务器故障',
              0x02: 'SOCKS5 连接不允许',
              0x03: 'SOCKS5 网络不可达',
              0x04: 'SOCKS5 主机不可达',
              0x05: 'SOCKS5 连接被拒绝',
              0x06: 'SOCKS5 TTL 过期',
              0x07: 'SOCKS5 不支持的命令',
              0x08: 'SOCKS5 不支持的地址类型',
            };
            const errMsg = errCodes[data[1]] || `SOCKS5 连接失败 (错误码: ${data[1]})`;
            cleanup();
            clearTimeout(timer);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, errMsg));
            return;
          }
          clearTimeout(timer);
          socket.removeAllListeners('data');
          socket.removeAllListeners('error');
          resolve(socket);
        }
      });

      socket.on('error', (err: Error) => {
        cleanup();
        clearTimeout(timer);
        reject(new AiCommitError(ErrorCode.NETWORK_ERROR, `SOCKS5 代理连接失败: ${err.message}`));
      });
    });
  }

  private sendSocks5Connect(socket: net.Socket, host: string, port: number): void {
    const isDomain = !/^\d+\.\d+\.\d+\.\d+$/.test(host);
    let connectBuf: Buffer;
    if (isDomain) {
      const domainBuf = Buffer.from(host);
      connectBuf = Buffer.alloc(4 + 1 + domainBuf.length + 2);
      connectBuf[0] = 0x05;
      connectBuf[1] = 0x01;
      connectBuf[2] = 0x00;
      connectBuf[3] = 0x03;
      connectBuf[4] = domainBuf.length;
      domainBuf.copy(connectBuf, 5);
      connectBuf.writeUInt16BE(port, 5 + domainBuf.length);
    } else {
      connectBuf = Buffer.alloc(4 + 4 + 2);
      connectBuf[0] = 0x05;
      connectBuf[1] = 0x01;
      connectBuf[2] = 0x00;
      connectBuf[3] = 0x01;
      const parts = host.split('.').map(Number);
      connectBuf[4] = parts[0];
      connectBuf[5] = parts[1];
      connectBuf[6] = parts[2];
      connectBuf[7] = parts[3];
      connectBuf.writeUInt16BE(port, 8);
    }
    socket.write(connectBuf);
  }

  private makeStreamRequest(
    url: string,
    headers: Record<string, string>,
    body: string,
    timeout: number,
    signal?: AbortSignal,
    proxy?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const proxyUrl = proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy;

      const reqHeaders: Record<string, string> = { ...headers };
      if (body) {
        reqHeaders['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const handleStreamResponse = (res: http.IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 400) {
          const errorCode = classifyHttpError(res.statusCode);
          let errorDetail = '';
          res.on('data', (chunk: Buffer) => { errorDetail += chunk; });
          res.on('end', () => {
            this.logger.error(`SSE 请求失败: ${res.statusCode} ${errorDetail}`);
            reject(new AiCommitError(errorCode, `API 请求失败: ${res.statusCode}`, errorDetail));
          });
          return;
        }

        let fullContent = '';
        let usageData: ChatCompletionResponse['usage'] | undefined;
        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) {
              continue;
            }
            const data = trimmed.substring(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
                usage?: ChatCompletionResponse['usage'];
              };
              if (parsed.choices && parsed.choices.length > 0) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  fullContent += delta.content;
                }
              }
              if (parsed.usage) {
                usageData = parsed.usage;
              }
            } catch {
              // skip malformed SSE data
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data: ') && trimmed.substring(6) !== '[DONE]') {
              try {
                const parsed = JSON.parse(trimmed.substring(6)) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                  usage?: ChatCompletionResponse['usage'];
                };
                if (parsed.choices && parsed.choices.length > 0) {
                  const delta = parsed.choices[0].delta;
                  if (delta && delta.content) {
                    fullContent += delta.content;
                  }
                }
                if (parsed.usage) {
                  usageData = parsed.usage;
                }
              } catch {
                // skip
              }
            }
          }

          const result: ChatCompletionResponse = {
            choices: [{ message: { content: fullContent } }],
            usage: usageData,
          };
          resolve(JSON.stringify(result));
        });
      };

      const sendStreamOverSocket = (socket: net.Socket) => {
        const agent = isHttps
          ? new https.Agent({ rejectUnauthorized: false })
          : new http.Agent();
        (agent as any).socket = socket;

        const actualOptions: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: reqHeaders,
          agent,
        };

        const lib = isHttps ? https : http;
        const req = lib.request(actualOptions, handleStreamResponse);
        attachHandlers(req);
      };

      const attachHandlers = (req: http.ClientRequest) => {
        this.attachErrorHandlers(req, reject, signal, timeout, false);
        if (body) {
          req.write(body);
        }
        req.end();
      };

      if (proxyUrl) {
        try {
          const parsedProxy = new URL(proxyUrl);
          const isSocks = parsedProxy.protocol === 'socks5:' || parsedProxy.protocol === 'socks5h:' || parsedProxy.protocol === 'socks:';
          this.logger.debug(`SSE 使用代理: ${parsedProxy.protocol}//${parsedProxy.hostname}:${parsedProxy.port}`);

          if (isSocks) {
            this.connectSocks5(
              parsedProxy.hostname,
              parseInt(parsedProxy.port || '1080', 10),
              parsedProxy.username,
              parsedProxy.password,
              parsedUrl.hostname,
              parseInt(parsedUrl.port || (isHttps ? '443' : '80'), 10),
              10000,
            ).then(socket => {
              sendStreamOverSocket(socket);
            }).catch(err => {
              reject(err instanceof AiCommitError ? err : new AiCommitError(ErrorCode.NETWORK_ERROR, `SOCKS5 代理连接失败: ${err.message}`));
            });
            return;
          }

          const connectOptions: http.RequestOptions = {
            hostname: parsedProxy.hostname,
            port: parsedProxy.port || (parsedProxy.protocol === 'https:' ? 443 : 80),
            path: url,
            method: 'CONNECT',
            headers: {},
          };

          if (parsedProxy.username || parsedProxy.password) {
            const auth = Buffer.from(`${parsedProxy.username}:${parsedProxy.password}`).toString('base64');
            (connectOptions.headers as Record<string, string>)['Proxy-Authorization'] = `Basic ${auth}`;
          }

          const connectReq = http.request(connectOptions);

          connectReq.on('connect', (res, socket) => {
            if (res.statusCode !== 200) {
              reject(new AiCommitError(ErrorCode.NETWORK_ERROR, `代理连接失败: ${res.statusCode}`));
              return;
            }
            sendStreamOverSocket(socket);
          });

          connectReq.on('error', (err: Error) => {
            this.logger.error(`SSE 代理连接错误: ${err.message}`);
            reject(new AiCommitError(ErrorCode.NETWORK_ERROR, `代理连接失败，请检查代理配置: ${err.message}`));
          });

          connectReq.setTimeout(10000, () => {
            connectReq.destroy();
            reject(new AiCommitError(ErrorCode.NETWORK_TIMEOUT, '代理连接超时'));
          });

          connectReq.end();
          return;
        } catch (e) {
          this.logger.warn(`代理配置解析失败: ${(e as Error).message}，回退到直连`);
        }
      }

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: reqHeaders,
      };

      const lib = isHttps ? https : http;
      const req = lib.request(options, handleStreamResponse);
      attachHandlers(req);
    });
  }

  private handleResponse(
    res: http.IncomingMessage,
    resolve: (value: string) => void,
    reject: (reason: any) => void,
  ): void {
    if (res.statusCode && res.statusCode >= 400) {
      const errorCode = classifyHttpError(res.statusCode);
      let errorDetail = '';
      res.on('data', (chunk: Buffer) => { errorDetail += chunk; });
      res.on('end', () => {
        this.logger.error(`API 请求失败: ${res.statusCode} ${errorDetail}`);
        reject(new AiCommitError(errorCode, `API 请求失败: ${res.statusCode}`, errorDetail));
      });
      return;
    }

    let data = '';
    res.on('data', (chunk: Buffer) => { data += chunk; });
    res.on('end', () => resolve(data));
  }

  private attachErrorHandlers(
    req: http.ClientRequest,
    reject: (reason: any) => void,
    signal?: AbortSignal,
    timeout?: number,
    isProxyConnect?: boolean,
  ): void {
    req.on('error', (err: Error) => {
      this.logger.error(`网络请求错误: ${err.message}`);
      if (err.message.includes('hang up') || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')) {
        const msg = isProxyConnect
          ? `代理连接被重置: ${err.message}。请检查代理地址和端口`
          : `连接被重置: ${err.message}。请检查 Base URL 是否正确、网络是否可用`;
        reject(new AiCommitError(ErrorCode.NETWORK_ERROR, msg));
      } else {
        reject(new AiCommitError(ErrorCode.NETWORK_ERROR, err.message));
      }
    });

    if (timeout) {
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new AiCommitError(ErrorCode.NETWORK_TIMEOUT, `请求超时 (${timeout}ms)`));
      });
    }

    if (signal?.aborted) {
      req.destroy();
      reject(new AiCommitError(ErrorCode.CANCELLED, '已取消生成'));
      return;
    }

    signal?.addEventListener('abort', () => {
      req.destroy();
      reject(new AiCommitError(ErrorCode.CANCELLED, '已取消生成'));
    }, { once: true });
  }
}

function getUserMessage(error: AiCommitError): string {
  switch (error.code) {
    case ErrorCode.API_AUTH_FAILED: return 'API 密钥无效，请检查配置';
    case ErrorCode.API_QUOTA_EXCEEDED: return 'API 额度不足，请检查账户余额';
    case ErrorCode.API_RATE_LIMITED: return 'API 请求过于频繁，请稍后重试';
    case ErrorCode.NETWORK_ERROR: return '网络连接失败，请检查网络设置';
    case ErrorCode.NETWORK_TIMEOUT: return '网络超时，请检查网络连接后重试';
    default: return error.message;
  }
}

function buildApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return base + '/' + path;
}
