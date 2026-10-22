import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminDAO } from '../data/db.js';
import { CONFIG } from '../config/index.js';

export async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const admin = AdminDAO.findByEmail(email.trim());
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      CONFIG.jwtSecret,
      { expiresIn: CONFIG.jwtExpiresIn }
    );

    return res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
}

export async function getAdminProfile(req, res) {
  return res.json({ admin: req.admin });
}

export async function downloadDatabaseBackup(req, res) {
  try {
    const { readDb } = await import('../data/db.js');
    const db = readDb();
    const dateStr = new Date().toISOString().split('T')[0];
    const backupName = `IppuClicks_Database_Backup_${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}"`);
    return res.send(JSON.stringify(db, null, 2));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create database backup.' });
  }
}
