import React, { useState } from 'react';
import { LockIcon } from '../common/Icons';
import { adminApi } from '../../services/api';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@ippuclicks.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await adminApi.login(email, password);
      onLoginSuccess(data.admin);
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0c]">
      <div className="w-full max-w-sm rounded-3xl bg-[#141418] border border-[#2a2a36] p-7 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/50 flex items-center justify-center text-[#f7d070] shadow-lg mb-3">
            <LockIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Admin Portal</h2>
          <p className="text-xs text-neutral-400 mt-1">Ippu Clicks Event Management Console</p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-white text-xs focus:border-[#d4af37] focus:outline-none"
              placeholder=""
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              Master Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-white text-xs focus:border-[#d4af37] focus:outline-none"
              placeholder=""
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Management'}
          </button>
        </form>

        <p className="text-[10px] text-center text-neutral-600 mt-6">
          Protected Area • Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
