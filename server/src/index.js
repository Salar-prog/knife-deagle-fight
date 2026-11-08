import { createServer } from 'http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { Server } from 'socket.io'
import { GameRoom } from './GameRoom.js'

const PORT = process.env.PORT || 3001

const app = express()

// Serve the built client when it exists (Docker / production).
// cwd-relative so it works from the repo root (dev) and /app (container).
const distDir = ['client/dist', 'dist']
  .map((d) => resolve(process.cwd(), d))
  .find((d) => existsSync(d))
if (distDir) app.use(express.static(distDir))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

const room = new GameRoom(io)

httpServer.listen(PORT, () => {
  console.log(`[server] running on :${PORT}`)
  if (distDir) console.log(`[server] serving client from ${distDir}`)
  else console.log('[server] no client build found — client dev server expected on :5173')
})

export { room }
