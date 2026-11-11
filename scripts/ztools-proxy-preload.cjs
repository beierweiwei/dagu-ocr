// [本地热修] ztools CLI 使用裸 https 模块且不支持任何代理环境变量，
// 直连 api.github.com 会间歇性 ECONNRESET，且任何网络错误都会被误判为 token 失效。
// 用法：NODE_OPTIONS="--require <本文件>" DAGU_CLI_PROXY=http://127.0.0.1:7890 ztools publish
// 仅在 DAGU_CLI_PROXY 存在时把 https.request 全部改走本地代理的 CONNECT 隧道。
'use strict'

if (process.env.DAGU_CLI_PROXY) {
  const http = require('http')
  const https = require('https')
  const tls = require('tls')
  const { URL } = require('url')
  const proxy = new URL(process.env.DAGU_CLI_PROXY)

  class TunnellingAgent extends https.Agent {
    // 代理上游对 github 间歇性 RST：仅在连接建立阶段透明重试（未发出请求体前，安全）。
    createConnection (options, callback) {
      const attempt = (left) => {
        this.connectOnce(options, (err, socket) => {
          if (err && left > 1) {
            setTimeout(() => attempt(left - 1), 800)
            return
          }
          callback(err, socket)
        })
      }
      attempt(3)
    }

    connectOnce (options, callback) {
      const host = options.host
      const port = options.port || 443
      const target = `${host}:${port}`
      const req = http.request({
        host: proxy.hostname,
        port: Number(proxy.port) || 80,
        method: 'CONNECT',
        path: target,
        headers: { Host: target }
      })
      req.once('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          socket.destroy()
          callback(new Error(`proxy CONNECT ${target} -> HTTP ${res.statusCode}`))
          return
        }
        const tlsSocket = tls.connect({
          socket,
          servername: options.servername || host,
          host,
          port,
          rejectUnauthorized: options.rejectUnauthorized
        }, () => callback(null, tlsSocket))
        tlsSocket.once('error', (err) => {
          try { tlsSocket.destroy() } catch {}
          callback(err)
        })
      })
      req.once('error', (err) => callback(err))
      req.end()
    }
  }

  const agent = new TunnellingAgent({ keepAlive: true })
  const originalRequest = https.request
  https.request = function (...args) {
    if (args[0] instanceof URL || typeof args[0] === 'string') {
      if (!(args[1] && typeof args[1] === 'object')) args.splice(1, 0, {})
      if (!args[1].agent) args[1].agent = agent
    } else if (args[0] && typeof args[0] === 'object' && !args[0].agent) {
      args[0].agent = agent
    }
    return originalRequest.apply(this, args)
  }
}
