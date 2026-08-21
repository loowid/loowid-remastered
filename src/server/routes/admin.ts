import { Router } from 'express';
import { Room } from '../models/room.js';
import { Log } from '../models/log.js';
import { Stats } from '../models/stats.js';
import { config } from '../config.js';

const router = Router();

// Basic auth middleware
function basicAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user === config.admin.username && pass === config.admin.password) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

// Stats summary
router.get('/stats', basicAuth, async (_req, res) => {
  const totalRooms = await Room.countDocuments({ status: 'ACTIVE' });
  const totalUsers = await Room.aggregate([
    { $match: { status: 'ACTIVE' } },
    { $project: { userCount: { $size: { $ifNull: ['$users', []] } } } },
    { $group: { _id: null, total: { $sum: '$userCount' } } },
  ]);

  res.json({
    rooms: totalRooms,
    users: totalUsers[0]?.total || 0,
  });
});

// Recent logs
router.get('/logs', basicAuth, async (req, res) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = 50;
  const logs = await Log.find()
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({ logs, page });
});

// Historical stats
router.get('/stats/history', basicAuth, async (_req, res) => {
  const stats = await Stats.find().sort({ date: -1 }).limit(30).lean();
  res.json({ stats });
});

export { router as adminRouter };
