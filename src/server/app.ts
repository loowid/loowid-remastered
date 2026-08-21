import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer, type Server as HttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { config } from './config.js';
import { roomsRouter } from './routes/rooms.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());
  app.use(morgan('combined'));

  // API routes
  app.use('/api/rooms', roomsRouter);
  app.use('/api/admin', adminRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '3.0.0' });
  });

  // Serve recordings
  app.use('/recordings', express.static('recordings'));

  // Serve static client build in production
  app.use(express.static('dist/client'));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile('index.html', { root: 'dist/client' });
  });

  return app;
}

export function createHttpServers(app: express.Express) {
  const sessionSecret = randomBytes(16).toString('hex');
  let httpsServer: HttpsServer | null = null;

  // Try to create HTTPS server if certs exist
  if (config.ssl.keyPath && config.ssl.certPath &&
      existsSync(config.ssl.keyPath) && existsSync(config.ssl.certPath)) {
    const credentials = {
      key: readFileSync(config.ssl.keyPath, 'utf-8'),
      cert: readFileSync(config.ssl.certPath, 'utf-8'),
    };
    httpsServer = createHttpServer(app) as unknown as HttpsServer;
    const httpsSrv = createServer(credentials, app);
    httpsServer = httpsSrv;
  }

  const httpServer = createHttpServer(app);

  return { httpServer, httpsServer, sessionSecret };
}
