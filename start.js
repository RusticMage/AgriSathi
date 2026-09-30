import http from 'node:http';
import { handler } from './server.js';

const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');
http.createServer(handler).listen(port, host, () => {
  console.log(`AgriSathi is running on ${host}:${port}`);
});
