/** 生成安全随机 ID；在非 HTTPS（手机 Safari）等环境 crypto.randomUUID 不可用时降级为随机字符串 */
export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch {}
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
