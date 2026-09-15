/**
 * WebSocket 客户端封装（零依赖，原生 WebSocket）。
 *
 * 职责：
 * - 连接生命周期管理：connect / disconnect / 自动重连（指数退避 1s→15s）
 * - 心跳保活：每 15s 发 ping，5s 内未收到 pong 判定连接已死并重连
 * - 消息收发：send(msg) 在连接未就绪时静默失败（返回 false），
 *   由上层 UI 根据连接状态禁用操作按钮
 * - 事件分发：onMessage 回调收到所有来自服务端的消息
 *
 * 断线恢复策略：训练请求在断线时不重发（避免重复训练），
 * 重连成功后由训练 store 通过 training.subscribe 恢复状态（见 stores/training.js）。
 */
import { CONFIG } from '../config'

export class WsClient {
  constructor() {
    this.ws = null
    this.url = CONFIG.defaultWsUrl
    this.status = 'offline' // 'connecting' | 'connected' | 'offline'
    this.retryCount = 0
    this.manualClose = false
    this.heartbeatTimer = null
    this.pongTimer = null
    this.onMessage = null // 由 connection store 注入
    this.onStatusChange = null
  }

  get connected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  connect(url) {
    if (url) this.url = url
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.manualClose = false
    this._setStatus('connecting')

    let ws
    try {
      ws = new WebSocket(this.url)
    } catch (err) {
      // URL 非法等异常 → 直接进入重试
      console.warn('[wsClient] 创建连接失败:', err.message)
      this._scheduleReconnect()
      return
    }

    this.ws = ws
    ws.onopen = () => {
      this.retryCount = 0
      this._setStatus('connected')
      this._startHeartbeat()
    }

    ws.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch (err) {
        console.warn('[wsClient] 收到无法解析的消息:', event.data)
        return
      }
      // pong 在内部消化，其余交给上层
      if (msg.type === 'pong') {
        this._clearPongTimer()
        return
      }
      if (typeof this.onMessage === 'function') {
        this.onMessage(msg)
      }
    }

    ws.onclose = () => {
      this._stopHeartbeat()
      if (!this.manualClose) {
        this._setStatus('offline')
        this._scheduleReconnect()
      } else {
        this._setStatus('offline')
      }
    }

    ws.onerror = () => {
      // onclose 一定会随后触发，统一在 onclose 里处理
    }
  }

  disconnect() {
    this.manualClose = true
    this._stopHeartbeat()
    if (this.ws) {
      try {
        this.ws.close()
      } catch (err) {
        /* 忽略 */
      }
      this.ws = null
    }
    this._setStatus('offline')
  }

  /** 发送消息；连接未就绪返回 false */
  send(msg) {
    if (!this.connected) return false
    try {
      this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
      return true
    } catch (err) {
      console.warn('[wsClient] 发送失败:', err.message)
      return false
    }
  }

  _setStatus(status) {
    this.status = status
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange(status)
    }
  }

  _scheduleReconnect() {
    if (this.manualClose) return
    const delay = Math.min(CONFIG.reconnectBase * 2 ** this.retryCount, CONFIG.reconnectMax)
    this.retryCount += 1
    setTimeout(() => this.connect(), delay)
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.connected) return
      const ok = this.send({ type: 'ping', id: `hb-${Date.now()}`, payload: { t: Date.now() } })
      if (!ok) return
      // 设定应答超时
      this._clearPongTimer()
      this.pongTimer = setTimeout(() => {
        console.warn('[wsClient] 心跳超时，判定连接失效')
        try {
          this.ws.close()
        } catch (err) {
          /* 忽略 */
        }
      }, CONFIG.heartbeatTimeout)
    }, CONFIG.heartbeatInterval)
  }

  _clearPongTimer() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this._clearPongTimer()
  }
}

/** 全局单例：整个应用只建一个 WebSocket 连接 */
export const wsClient = new WsClient()
