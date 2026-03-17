const path = require('path')
const fs = require('fs')
const dir = path.join(__dirname)
process.env.NODE_ENV = 'production'
process.chdir(__dirname)
const currentPort = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'
const configPath = path.join(dir, '.next/required-server-files.json')
if (!fs.existsSync(configPath)) {
    console.error('Error: .next/required-server-files.json not found!');
    process.exit(1);
}
const requiredFiles = JSON.parse(fs.readFileSync(configPath, 'utf8'))
requiredFiles.config.turbopack = { root: '/app' }
requiredFiles.appDir = '/app'
const nextConfig = requiredFiles.config
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)
require('next')
const { startServer } = require('next/dist/server/lib/start-server')
let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
if (Number.isNaN(keepAliveTimeout) || !Number.isFinite(keepAliveTimeout) || keepAliveTimeout < 0) {
  keepAliveTimeout = undefined
}
console.log('🚀 Starting SLTSERP Standalone Server on', hostname, 'port', currentPort)
startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
