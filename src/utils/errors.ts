export enum ErrorCode {
  NOT_GIT_REPO = 'NOT_GIT_REPO',
  STAGING_EMPTY = 'STAGING_EMPTY',
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  DIFF_TOO_LARGE = 'DIFF_TOO_LARGE',
  AI_RESPONSE_EMPTY = 'AI_RESPONSE_EMPTY',
  AI_RESPONSE_PARSE_ERROR = 'AI_RESPONSE_PARSE_ERROR',
  API_AUTH_FAILED = 'API_AUTH_FAILED',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  GIT_NOT_FOUND = 'GIT_NOT_FOUND',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

export class AiCommitError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AiCommitError';
  }
}

export function getUserMessage(error: unknown): string {
  if (error instanceof AiCommitError) {
    switch (error.code) {
      case ErrorCode.NOT_GIT_REPO:
        return '当前工作区不是 Git 仓库';
      case ErrorCode.STAGING_EMPTY:
        if (error.detail) {
          return `暂存区无变更，${error.detail}。请在源代码管理面板中点击文件旁的「+」暂存，或点击「暂存所有变更」`;
        }
        return '暂存区无变更，请先暂存需要提交的文件';
      case ErrorCode.MERGE_CONFLICT:
        return '存在未解决的合并冲突，请先解决后再生成';
      case ErrorCode.DIFF_TOO_LARGE:
        return '变更内容过大，已进行智能截断处理';
      case ErrorCode.AI_RESPONSE_EMPTY:
        return 'AI 未返回有效内容，请尝试重新生成';
      case ErrorCode.AI_RESPONSE_PARSE_ERROR:
        return 'AI 返回内容无法解析，已填入原始文本';
      case ErrorCode.API_AUTH_FAILED:
        return 'API 密钥无效，请检查配置';
      case ErrorCode.API_QUOTA_EXCEEDED:
        return 'API 额度不足，请检查账户余额';
      case ErrorCode.API_RATE_LIMITED:
        return 'API 请求过于频繁，请稍后重试';
      case ErrorCode.NETWORK_ERROR:
        return '网络连接失败，请检查网络设置';
      case ErrorCode.NETWORK_TIMEOUT:
        return '网络超时，请检查网络连接后重试';
      case ErrorCode.GIT_NOT_FOUND:
        return '未检测到 Git，请先安装 Git';
      case ErrorCode.CANCELLED:
        return '已取消生成';
      default:
        return error.message || '未知错误';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function classifyHttpError(status: number): ErrorCode {
  if (status === 401 || status === 403) {
    return ErrorCode.API_AUTH_FAILED;
  }
  if (status === 402) {
    return ErrorCode.API_QUOTA_EXCEEDED;
  }
  if (status === 429) {
    return ErrorCode.API_RATE_LIMITED;
  }
  return ErrorCode.NETWORK_ERROR;
}
