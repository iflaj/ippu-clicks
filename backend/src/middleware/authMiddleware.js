import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/index.js';
import { AdminDAO } from '../data/db.js';

export function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Access denied.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, CONFIG.jwtSecret);

    const admin = AdminDAO.findById(decoded.id);
    if (!admin || admin.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    req.admin = { id: admin.id, email: admin.email, role: admin.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
