// Preload script: force every Node fetch() to use IPv4 sockets.
// Fixes Node 22 dual-stack bug where undici re-resolves IPv6 after first call,
// ignoring --dns-result-order. Works for wrangler, neon-serverless, etc.
const { Agent, setGlobalDispatcher } = require('undici');
const tls = require('tls');
const net = require('net');

setGlobalDispatcher(new Agent({
  connect: (opts, cb) => {
    const s = net.connect({ host: opts.hostname, port: opts.port || 443, family: 4 });
    s.on('connect', () => cb(null, tls.connect({
      socket: s,
      servername: opts.hostname,
      rejectUnauthorized: true,
    })));
    s.on('error', e => cb(e));
  },
}));
