import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email to confirm your account, then log in.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-disp { font-family: 'Rajdhani', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>
      <div className="font-body w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center mb-3">
            <Zap size={28} className="text-slate-950" strokeWidth={2.5} fill="currentColor" />
          </div>
          <h1 className="font-disp font-bold text-2xl text-slate-50">GymQuest</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'login' ? 'Log in to continue your quest' : 'Create your character'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-50 placeholder-slate-500 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-50 placeholder-slate-500 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-disp font-bold uppercase tracking-wide text-sm bg-amber-400 text-slate-950 rounded-xl py-3 hover:bg-amber-300 transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setMessage('');
            }}
            className="text-amber-400 font-semibold"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
