export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/loowid',
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  ssl: {
    keyPath: process.env.SSL_KEY_PATH || '',
    certPath: process.env.SSL_CERT_PATH || '',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },
  coturn: {
    server: process.env.COTURN_SERVER || '',
    authUsername: process.env.COTURN_AUTH_USERNAME || '',
    authSecret: process.env.COTURN_AUTH_SECRET || '',
    authHours: parseInt(process.env.COTURN_AUTH_HOURS || '24', 10),
    exclusive: process.env.COTURN_EXCLUSIVE === 'true',
  },
  chromeExtensionId: process.env.CEXTID || 'ocegbggnlgopmchofgnbjhgpljlchlpl',
  ws: {
    host: process.env.WS_HOST || '',
    port: process.env.WS_PORT || '',
  },
  roomTimeoutDays: parseInt(process.env.ROOM_TIMEOUT || '15', 10),
  lti: {
    key: process.env.LTI_KEY || 'key',
    secret: process.env.LTI_SECRET || 'secret',
    path: process.env.LTI_PATH || '/lti',
    domain: process.env.LTI_DOMAIN || '',
    ownerRoles: (process.env.LTI_OWNER_ROLES || 'Instructor').split(','),
  },
};
