/**
 * 前端全局配置：WebSocket 地址、心跳间隔、各种上限。
 * WS 地址可在界面右上角"连接设置"中修改，保存在 localStorage。
 */
export const CONFIG = {
  // 默认后端 WebSocket 地址（mock 服务器也使用此端口）
  defaultWsUrl: 'ws://127.0.0.1:8765',
  // localStorage 中保存设置的键名
  settingsKey: 'mlviz.settings',
  // 心跳间隔（毫秒）
  heartbeatInterval: 15000,
  // 心跳应答超时（毫秒），超时判定连接已死
  heartbeatTimeout: 5000,
  // 重连退避：起始 1s，每次翻倍，上限 15s
  reconnectBase: 1000,
  reconnectMax: 15000,
  // 实时曲线每个序列最多保留的点数
  maxChartPoints: 500,
  // progress 消息渲染节流（毫秒）：距上一条小于该间隔则丢弃
  progressThrottleMs: 100,
  // 日志面板最多保留行数
  maxLogLines: 200,
  // 训练历史最多保留条数（localStorage）
  maxHistory: 50
}
