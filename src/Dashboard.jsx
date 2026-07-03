import React, { useState, useRef } from 'react';
import * as Tone from 'tone';
import { supabase } from './supabaseClient';
import {
  Zap, Flame, Sun, Moon, Bell, Dumbbell, ClipboardCheck, Camera,
  TrendingUp, CheckCircle2, Circle, Swords, Trophy, Users, ChevronRight,
  Home, Target, User, Calendar, Lock, Settings,
} from 'lucide-react';

/* ---------------------------------- mock data (not yet wired to the DB) ---------------------------------- */

const STATS = [
  { key: 'STR', label: 'Strength', value: 68 },
  { key: 'PWR', label: 'Power', value: 54 },
  { key: 'END', label: 'Endurance', value: 72 },
  { key: 'DISC', label: 'Discipline', value: 81 },
  { key: 'STAM', label: 'Stamina', value: 60 },
];

const WEEKLY_QUESTS = [
  { id: 101, title: 'Complete 4 workouts', xp: 200, progress: 3, target: 4 },
  { id: 102, title: 'Log a new personal record', xp: 150, progress: 0, target: 1 },
  { id: 103, title: 'Log 20 total sets', xp: 100, progress: 14, target: 20 },
];

const ACTIVITY = [
  { name: 'Jordan', action: 'crushed Leg Day', time: '2h ago' },
  { name: 'Taylor', action: 'joined Iron Wolves guild', time: '5h ago' },
  { name: 'Sam', action: 'hit a new bench PR — 225 lb', time: 'yesterday' },
];

const RANKS_DATA = {
  guild: [
    { rank: 1, name: 'Blaze', xp: 9120 },
    { rank: 2, name: 'Nova', xp: 8340 },
    { rank: 3, name: 'Jordan', xp: 4820 },
    { rank: 4, name: 'Sam', xp: 4510 },
    { rank: 5, name: 'You', xp: 2340, isUser: true },
  ],
  global: [
    { rank: 1, name: 'IronPhoenix', xp: 48200 },
    { rank: 2, name: 'ShredKing', xp: 44100 },
    { rank: 3, name: 'QuestMaster', xp: 41500 },
    { rank: 1042, name: 'You', xp: 2340, isUser: true },
  ],
};

const BADGES = [
  { id: 1, label: '7-Day Streak', Icon: Flame, unlocked: true },
  { id: 2, label: 'First PR', Icon: TrendingUp, unlocked: true },
  { id: 3, label: 'Guild Joined', Icon: Users, unlocked: true },
  { id: 4, label: '100 Workouts', Icon: Dumbbell, unlocked: false },
  { id: 5, label: '30-Day Streak', Icon: Flame, unlocked: false },
  { id: 6, label: 'Season Champion', Icon: Trophy, unlocked: false },
];

const PROFILE_STATS = [
  { label: 'Workouts', value: '142' },
  { label: 'Longest Streak', value: '23d' },
  { label: 'Total XP', value: '38.4k' },
  { label: 'Member Since', value: 'Mar 2026' },
];

const NAV = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'quests', label: 'Quests', Icon: Target },
  { key: 'ranks', label: 'Ranks', Icon: Trophy },
  { key: 'guild', label: 'Guild', Icon: Users },
  { key: 'profile', label: 'Profile', Icon: User },
];

const QUEST_ICONS = {
  'Log 8 working sets': ClipboardCheck,
  'Gym photo check-in': Camera,
  'Beat a previous PR': TrendingUp,
};
function getQuestIcon(title) {
  return QUEST_ICONS[title] || Target;
}

const XP_PER_LEVEL = 3000;

/* --------------------------- pentagon geometry helpers -------------------------- */

const CX = 130, CY = 112, R = 58;

function pointAt(index, total, radius) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}
function gridRing(total, pct) {
  return Array.from({ length: total }, (_, i) => {
    const p = pointAt(i, total, (R * pct) / 100);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}
function statPolygon(stats) {
  return stats
    .map((s, i) => {
      const p = pointAt(i, stats.length, (R * s.value) / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}

/* --------------------------------- small pieces --------------------------------- */

function ProgressRing({ pct, size, stroke, colorClass, trackClass }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        className={colorClass} strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.65,0,0.35,1)' }}
      />
    </svg>
  );
}

function Eyebrow({ children, className = '' }) {
  return (
    <div className={`font-disp text-xs font-bold tracking-widest uppercase ${className}`}>
      {children}
    </div>
  );
}

function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 28 });
  const colors = ['#fbbf24', '#fb923c', '#22d3ee', '#f43f5e', '#34d399'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.3;
        const duration = 1.6 + Math.random() * 1;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            className="absolute rounded-sm confetti-piece"
            style={{
              top: '-12px',
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              backgroundColor: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function HeroQuestCard({ quest, onComplete, T, A, dark, compact }) {
  if (!quest) return null;
  return (
    <div className={`relative rounded-2xl border-l-4 border-amber-400 border ${T.card} ${T.border} p-4 ${compact ? 'mb-3' : 'mb-6'} overflow-hidden`}>
      <Eyebrow className={A.gold}>Push / Pull / Legs · Day 1</Eyebrow>
      <div className="flex items-center justify-between mt-1">
        <h2 className={`font-disp font-bold ${compact ? 'text-xl' : 'text-2xl'}`}>{quest.title}</h2>
        <Dumbbell size={compact ? 22 : 26} className={dark ? 'text-slate-700' : 'text-slate-300'} />
      </div>
      <p className={`text-sm ${T.sub} mt-1`}>Chest · Shoulders · Triceps</p>
      <div className={`flex items-center justify-between ${compact ? 'mt-3' : 'mt-4'}`}>
        <span className={`font-disp font-bold text-sm ${A.gold}`}>+{quest.xp_reward} XP</span>
        <button
          onClick={onComplete}
          disabled={quest.done}
          className={`font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors ${
            quest.done ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
          }`}
        >
          {quest.done ? (
            <>
              <CheckCircle2 size={16} /> Complete
            </>
          ) : (
            <>
              Begin Quest <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function QuestRow({ quest, onToggle, onPhotoChange, uploading, T }) {
  const Icon = getQuestIcon(quest.title);
  const needsPhoto = quest.title === 'Gym photo check-in';
  const rowClass = `w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${T.card} ${T.border}`;

  const inner = (
    <>
      {quest.photo_url ? (
        <img src={quest.photo_url} alt="" style={{ width: 18, height: 18 }} className="rounded-full object-cover" />
      ) : (
        <Icon size={18} className={quest.done ? 'text-emerald-400' : T.sub} />
      )}
      <span className={`flex-1 text-sm font-medium ${quest.done ? `line-through ${T.faint}` : T.text}`}>
        {uploading ? 'Uploading…' : quest.title}
      </span>
      <span className={`font-disp text-xs font-bold ${T.faint}`}>+{quest.xp_reward}</span>
      {quest.done ? (
        <CheckCircle2 size={18} className="text-emerald-400" />
      ) : (
        <Circle size={18} className={T.faint} />
      )}
    </>
  );

  if (needsPhoto && !quest.done) {
    return (
      <label className={`${rowClass} cursor-pointer`}>
        {inner}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={(e) => onPhotoChange(e, quest)}
        />
      </label>
    );
  }

  return (
    <button onClick={() => onToggle(quest)} className={rowClass}>
      {inner}
    </button>
  );
}

/* ------------------------------------ main --------------------------------------- */

export default function Dashboard({
  userId,
  initialXp = 0,
  initialLevel = 1,
  initialStreak = 0,
  username = 'You',
  initialQuests = [],
  initialBoss = null,
  initialGuild = null,
  initialAvailableGuilds = [],
  initialFriends = [],
  initialFriendRequests = [],
  initialOutgoingIds = [],
  onSignOut,
}) {
  const [dark, setDark] = useState(true);
  const [quests, setQuests] = useState(initialQuests);
  const [boss, setBoss] = useState(initialBoss);
  const [xp, setXp] = useState(initialXp);
  const [level, setLevel] = useState(initialLevel);
  const [activeTab, setActiveTab] = useState('home');
  const [rankTab, setRankTab] = useState('friends');
  const [toast, setToast] = useState(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [guildInfo, setGuildInfo] = useState(initialGuild);
  const [availableGuilds, setAvailableGuilds] = useState(initialAvailableGuilds);
  const [newGuildName, setNewGuildName] = useState('');
  const [guildBusy, setGuildBusy] = useState(false);
  const [friends, setFriends] = useState(initialFriends);
  const [friendRequests, setFriendRequests] = useState(initialFriendRequests);
  const [pendingOutgoingIds, setPendingOutgoingIds] = useState(initialOutgoingIds);
  const [friendSearch, setFriendSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const toastTimer = useRef(null);

  const T = dark
    ? { page: 'bg-black', bg: 'bg-slate-950', card: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-50', sub: 'text-slate-400', faint: 'text-slate-500', track: 'bg-slate-800' }
    : { page: 'bg-slate-300', bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', sub: 'text-slate-500', faint: 'text-slate-400', track: 'bg-slate-200' };

  const A = dark
    ? { gold: 'text-amber-400', ember: 'text-orange-400', cyan: 'text-cyan-400', rose: 'text-rose-400' }
    : { gold: 'text-amber-600', ember: 'text-orange-600', cyan: 'text-cyan-600', rose: 'text-rose-600' };

  const fireToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  const playLevelUpSound = async () => {
    try {
      await Tone.start();
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      const now = Tone.now();
      synth.triggerAttackRelease('C5', '8n', now);
      synth.triggerAttackRelease('E5', '8n', now + 0.12);
      synth.triggerAttackRelease('G5', '8n', now + 0.24);
      synth.triggerAttackRelease('C6', '4n', now + 0.36);
    } catch (err) {
      // audio isn't available in this context, fail silently
    }
  };

  const celebrateLevelUp = () => {
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 2200);
    playLevelUpSound();
  };

  const applyXP = (delta) => {
    let next = xp + delta;
    let leveledUp = false;
    if (next >= XP_PER_LEVEL) {
      next -= XP_PER_LEVEL;
      leveledUp = true;
    }
    if (next < 0) next = 0;
    const newLevel = leveledUp ? level + 1 : level;
    setXp(next);
    if (leveledUp) {
      setLevel(newLevel);
      fireToast('LEVEL UP!');
      celebrateLevelUp();
    } else if (delta > 0) {
      fireToast(`+${delta} XP`);
    }
    supabase
      .from('profiles')
      .update({ xp: next, level: newLevel })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Failed to save XP:', error);
      });
  };

  const damageBoss = (amount) => {
    setBoss((prev) => {
      if (!prev) return prev;
      const newHp = Math.max(0, prev.current_hp - amount);
      supabase
        .from('boss_battles')
        .update({ current_hp: newHp })
        .eq('id', prev.id)
        .then(({ error }) => {
          if (error) console.error('Failed to save boss damage:', error);
        });
      return { ...prev, current_hp: newHp };
    });
  };

  const toggleQuest = (quest) => {
    if (quest.kind === 'hero' && quest.done) return;
    const newDone = !quest.done;
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, done: newDone } : q)));
    applyXP(newDone ? quest.xp_reward : -quest.xp_reward);
    supabase
      .from('quests')
      .update({ done: newDone })
      .eq('id', quest.id)
      .then(({ error }) => {
        if (error) console.error('Failed to save quest:', error);
      });
    if (quest.kind === 'hero' && newDone) {
      damageBoss(quest.xp_reward);
    }
  };

  const completeHero = () => {
    if (!heroQuest || heroQuest.done) return;
    toggleQuest(heroQuest);
  };

  const handlePhotoUpload = async (e, quest) => {
    const file = e.target.files?.[0];
    if (!file || quest.done) return;
    setUploadingId(quest.id);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('checkins').upload(filePath, file);
    if (uploadError) {
      fireToast('Upload failed');
      setUploadingId(null);
      return;
    }
    const { data: urlData } = supabase.storage.from('checkins').getPublicUrl(filePath);
    const photoUrl = urlData.publicUrl;
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, done: true, photo_url: photoUrl } : q)));
    applyXP(quest.xp_reward);
    await supabase.from('quests').update({ done: true }).eq('id', quest.id);
    await supabase.from('checkins').insert({ user_id: userId, photo_url: photoUrl });
    setUploadingId(null);
  };

  const fetchRoster = async (guildId) => {
    const { data: rosterRows } = await supabase
      .from('guild_members')
      .select('user_id, profiles ( username, level, xp )')
      .eq('guild_id', guildId);
    return (rosterRows || [])
      .map((r) => ({ userId: r.user_id, username: r.profiles?.username, level: r.profiles?.level, xp: r.profiles?.xp || 0 }))
      .sort((a, b) => b.xp - a.xp);
  };

  const joinGuild = async (guildId, guildName) => {
    setGuildBusy(true);
    const { error } = await supabase.from('guild_members').insert({ guild_id: guildId, user_id: userId });
    if (error) {
      fireToast('Could not join guild');
      setGuildBusy(false);
      return;
    }
    const roster = await fetchRoster(guildId);
    setGuildInfo({ id: guildId, name: guildName, roster });
    setGuildBusy(false);
    fireToast('Joined guild!');
  };

  const createGuild = async () => {
    if (!newGuildName.trim()) return;
    setGuildBusy(true);
    const { data, error } = await supabase.from('guilds').insert({ name: newGuildName.trim() }).select().single();
    if (error || !data) {
      fireToast('Could not create guild');
      setGuildBusy(false);
      return;
    }
    setNewGuildName('');
    await joinGuild(data.id, data.name);
  };

  const leaveGuild = async () => {
    if (!guildInfo) return;
    setGuildBusy(true);
    await supabase.from('guild_members').delete().eq('guild_id', guildInfo.id).eq('user_id', userId);
    setGuildInfo(null);
    const { data: guildsList } = await supabase.from('guilds').select('id, name');
    setAvailableGuilds(guildsList || []);
    setGuildBusy(false);
  };

  const searchUsers = async () => {
    const q = friendSearch.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', userId)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const sendFriendRequest = async (targetId) => {
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: targetId, status: 'pending' });
    if (error) {
      fireToast('Could not send request');
      return;
    }
    setPendingOutgoingIds((prev) => [...prev, targetId]);
    fireToast('Friend request sent');
  };

  const acceptFriendRequest = async (request) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', request.friendshipId);
    setFriendRequests((prev) => prev.filter((r) => r.friendshipId !== request.friendshipId));
    setFriends((prev) =>
      [...prev, { userId: request.userId, username: request.username, xp: request.xp, level: request.level }].sort((a, b) => b.xp - a.xp)
    );
    fireToast('Friend added!');
  };

  const declineFriendRequest = async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setFriendRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  };

  const heroQuest = quests.find((q) => q.kind === 'hero');
  const sideQuests = quests.filter((q) => q.kind !== 'hero');
  const totalToday = quests.length || 1;
  const doneToday = quests.filter((q) => q.done).length;

  const pct = Math.min(100, (xp / XP_PER_LEVEL) * 100);
  const grid25 = gridRing(STATS.length, 25);
  const grid50 = gridRing(STATS.length, 50);
  const grid75 = gridRing(STATS.length, 75);
  const grid100 = gridRing(STATS.length, 100);
  const statPoly = statPolygon(STATS);
  const statVerts = STATS.map((s, i) => pointAt(i, STATS.length, (R * s.value) / 100));
  const axisEnds = STATS.map((_, i) => pointAt(i, STATS.length, R));
  const labelPts = STATS.map((_, i) => pointAt(i, STATS.length, R + 28));
  const rankList =
    rankTab === 'guild'
      ? guildInfo
        ? guildInfo.roster.map((p, idx) => ({
            rank: idx + 1,
            name: p.userId === userId ? username : p.username,
            xp: p.xp,
            isUser: p.userId === userId,
          }))
        : []
      : RANKS_DATA[rankTab];
  const friendBoard = [...friends, { userId, username, xp }].sort((a, b) => b.xp - a.xp);

  let mainContent = null;

  if (activeTab === 'home') {
    mainContent = (
      <>
        {/* ---------- top bar ---------- */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center">
              <Zap size={19} className="text-slate-950" strokeWidth={2.5} fill="currentColor" />
            </div>
            <span className="font-disp font-bold text-xl tracking-tight">GymQuest</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border ${T.card} ${T.border}`}
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
            </button>
            <button className={`w-9 h-9 rounded-full flex items-center justify-center border relative ${T.card} ${T.border}`} aria-label="Notifications">
              <Bell size={15} className={T.sub} />
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
            </button>
          </div>
        </div>

        {/* ---------- streak + level row ---------- */}
        <div className="flex items-stretch gap-3 mb-4">
          <div className={`flex-1 rounded-2xl border ${T.card} ${T.border} p-3 flex items-center gap-3`}>
            <div className="w-11 h-11 rounded-xl bg-orange-500 bg-opacity-10 flex items-center justify-center" style={{ boxShadow: dark ? '0 0 18px rgba(251,146,60,0.25)' : 'none' }}>
              <Flame size={22} className={`flame-pulse ${A.ember}`} fill="currentColor" />
            </div>
            <div>
              <div className="font-disp font-bold text-xl leading-none">{initialStreak}</div>
              <div className={`text-xs ${T.sub} mt-0.5`}>day streak</div>
            </div>
          </div>

          <div className={`rounded-2xl border ${T.card} ${T.border} p-3 flex items-center gap-3`}>
            <div className="relative w-12 h-12 shrink-0">
              <ProgressRing pct={pct} size={48} stroke={4} colorClass="stroke-amber-400" trackClass={dark ? 'stroke-slate-800' : 'stroke-slate-200'} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-disp font-bold text-sm">{level}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold leading-none">Level {level}</div>
              <div className={`text-xs ${T.sub} mt-1`}>{xp.toLocaleString()}/{XP_PER_LEVEL.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className={`w-full h-2 rounded-full ${T.track} overflow-hidden mb-6`}>
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%`, transition: 'width 500ms ease' }} />
        </div>

        <HeroQuestCard quest={heroQuest} onComplete={completeHero} T={T} A={A} dark={dark} />

        {/* ---------- attributes ---------- */}
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <Eyebrow className={T.faint}>Character Attributes</Eyebrow>
          <svg viewBox="0 0 260 230" className="w-full h-auto mt-1">
            {[grid25, grid50, grid75, grid100].map((pts, i) => (
              <polygon key={i} points={pts} fill="none" className={dark ? 'stroke-slate-700' : 'stroke-slate-300'} strokeWidth="1" />
            ))}
            {axisEnds.map((p, i) => (
              <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} className={dark ? 'stroke-slate-700' : 'stroke-slate-300'} strokeWidth="1" />
            ))}
            <polygon points={statPoly} className="fill-cyan-400 stroke-cyan-400" fillOpacity="0.28" strokeWidth="2" />
            {statVerts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" className="fill-cyan-300" />
            ))}
            {STATS.map((s, i) => {
              const p = labelPts[i];
              const anchor = p.x < CX - 6 ? 'end' : p.x > CX + 6 ? 'start' : 'middle';
              return (
                <text key={s.key} x={p.x} y={p.y} textAnchor={anchor} className={`text-xs font-bold font-disp ${T.sub}`}>
                  {s.key}
                </text>
              );
            })}
          </svg>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {STATS.map((s) => (
              <div key={s.key} className="text-center">
                <div className="font-disp font-bold text-sm text-cyan-400">{s.value}</div>
                <div className={`text-xs ${T.faint}`}>{s.key}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- side quests ---------- */}
        <div className="mb-6">
          <Eyebrow className={`${T.faint} mb-2`}>Side Quests</Eyebrow>
          <div className="space-y-2">
            {sideQuests.map((q) => (
              <QuestRow key={q.id} quest={q} onToggle={toggleQuest} onPhotoChange={handlePhotoUpload} uploading={uploadingId === q.id} T={T} />
            ))}
          </div>
        </div>

        {/* ---------- rival ---------- */}
        <div className={`rounded-2xl border-l-4 border-rose-500 border ${T.card} ${T.border} p-4 mb-6`}>
          <div className="flex items-center gap-2 mb-3">
            <Swords size={16} className={A.rose} />
            <Eyebrow className={A.rose}>Rival Watch · This Week</Eyebrow>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold mb-1.5">
            <span>You · 520 XP</span>
            <span>Sam · 640 XP</span>
          </div>
          <div className={`w-full h-2.5 rounded-full ${T.track} overflow-hidden flex`}>
            <div className="h-full bg-cyan-400" style={{ width: '45%' }} />
            <div className="h-full bg-rose-500" style={{ width: '55%' }} />
          </div>
          <p className={`text-xs ${T.sub} mt-2`}>Sam is 120 XP ahead — a solid session tonight closes the gap.</p>
        </div>

        {/* ---------- leaderboard ---------- */}
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className={A.gold} />
              <Eyebrow className={A.gold}>Friend Leaderboard</Eyebrow>
            </div>
            <span className={`text-xs font-medium ${T.sub} flex items-center gap-0.5`}>
              See all <ChevronRight size={12} />
            </span>
          </div>
          {friendBoard.length <= 1 ? (
            <p className={`text-xs ${T.faint}`}>No friends yet — add some from the Ranks tab.</p>
          ) : (
            <div className="space-y-2">
              {friendBoard.slice(0, 5).map((p, idx) => {
                const isMe = p.userId === userId;
                return (
                  <div
                    key={p.userId}
                    className={`flex items-center gap-3 rounded-lg ${isMe ? '-mx-1 px-1 py-1 bg-amber-400 bg-opacity-10 border border-amber-400 border-opacity-30' : ''}`}
                  >
                    <span className={`font-disp font-bold text-sm w-5 ${isMe ? 'text-amber-400' : T.faint}`}>{idx + 1}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? 'bg-amber-400 text-slate-950' : T.track}`}>
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <span className={`flex-1 text-sm ${isMe ? 'font-semibold' : 'font-medium'}`}>{p.username}</span>
                    <span className={`text-xs font-semibold ${isMe ? 'text-emerald-400' : T.sub}`}>{(p.xp || 0).toLocaleString()} XP</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- friend activity ---------- */}
        <div className="mb-6">
          <Eyebrow className={`${T.faint} mb-2`}>Friend Activity</Eyebrow>
          <div className="space-y-2.5">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${T.track}`}>
                  {a.name[0]}
                </div>
                <p className="text-sm flex-1">
                  <span className="font-semibold">{a.name}</span>{' '}
                  <span className={T.sub}>{a.action}</span>
                </p>
                <span className={`text-xs shrink-0 ${T.faint}`}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- season banner ---------- */}
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow className={A.gold}>Summer Shred · Season 3</Eyebrow>
            <span className={`text-xs font-semibold ${T.sub}`}>Week 3 / 8</span>
          </div>
          <div className={`w-full h-2 rounded-full ${T.track} overflow-hidden mb-2`}>
            <div className="h-full rounded-full bg-amber-400" style={{ width: '37.5%' }} />
          </div>
          <p className={`text-xs ${T.sub}`}>Season rank #12 — finish top 10 to unlock the Shred Champion badge.</p>
        </div>
      </>
    );
  } else if (activeTab === 'quests') {
    mainContent = (
      <>
        <div className="mb-5">
          <h1 className="font-disp font-bold text-2xl">Quests</h1>
          <p className={`text-sm ${T.sub} mt-0.5`}>{doneToday} of {quests.length} complete today</p>
          <div className={`w-full h-1.5 rounded-full ${T.track} overflow-hidden mt-2`}>
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.min(100, (doneToday / totalToday) * 100)}%`, transition: 'width 400ms ease' }}
            />
          </div>
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Today</Eyebrow>
        <HeroQuestCard quest={heroQuest} onComplete={completeHero} T={T} A={A} dark={dark} compact />

        <div className="space-y-2 mb-6">
          {sideQuests.map((q) => (
            <QuestRow key={q.id} quest={q} onToggle={toggleQuest} onPhotoChange={handlePhotoUpload} uploading={uploadingId === q.id} T={T} />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className={A.gold} />
          <Eyebrow className={A.gold}>This Week</Eyebrow>
        </div>
        <div className="space-y-2">
          {WEEKLY_QUESTS.map((w) => (
            <div key={w.id} className={`rounded-xl border p-3 ${T.card} ${T.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{w.title}</span>
                <span className={`font-disp text-xs font-bold ${T.faint}`}>+{w.xp}</span>
              </div>
              <div className={`w-full h-2 rounded-full ${T.track} overflow-hidden mb-1`}>
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (w.progress / w.target) * 100)}%` }} />
              </div>
              <span className={`text-xs ${T.faint}`}>{w.progress}/{w.target}</span>
            </div>
          ))}
        </div>
      </>
    );
  } else if (activeTab === 'ranks') {
    mainContent = (
      <>
        <h1 className="font-disp font-bold text-2xl mb-4">Ranks</h1>
        <div className={`flex rounded-xl border p-1 mb-4 ${T.card} ${T.border}`}>
          {['friends', 'guild', 'global'].map((key) => (
            <button
              key={key}
              onClick={() => setRankTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                rankTab === key ? 'bg-amber-400 text-slate-950' : T.sub
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {rankTab === 'friends' ? (
          <>
            <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-4`}>
              <Eyebrow className={`${T.faint} mb-2`}>Add Friends</Eyebrow>
              <div className="flex gap-2">
                <input
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  placeholder="Search by username"
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
                />
                <button
                  onClick={searchUsers}
                  disabled={searching}
                  className="font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
                >
                  Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 mt-3">
                  {searchResults.map((u) => {
                    const alreadyFriend = friends.some((f) => f.userId === u.id);
                    const requested = pendingOutgoingIds.includes(u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${T.track}`}>
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                        <span className="flex-1 text-sm font-medium">{u.username}</span>
                        <button
                          onClick={() => sendFriendRequest(u.id)}
                          disabled={alreadyFriend || requested}
                          className="font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 disabled:opacity-50"
                        >
                          {alreadyFriend ? 'Friends' : requested ? 'Requested' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {friendRequests.length > 0 && (
              <>
                <Eyebrow className={`${T.faint} mb-2`}>Requests</Eyebrow>
                <div className="space-y-2 mb-4">
                  {friendRequests.map((r) => (
                    <div key={r.friendshipId} className={`flex items-center gap-3 rounded-xl border p-3 ${T.card} ${T.border}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${T.track}`}>
                        {r.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm font-medium">{r.username}</span>
                      <button
                        onClick={() => acceptFriendRequest(r)}
                        className="font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 mr-1.5"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineFriendRequest(r.friendshipId)}
                        className={`font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg ${T.track} ${T.sub}`}
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Eyebrow className={`${T.faint} mb-2`}>Your Friends</Eyebrow>
            {friends.length === 0 ? (
              <p className={`text-sm ${T.faint}`}>No friends yet — search above to add some.</p>
            ) : (
              <div className="space-y-1.5">
                {friends.map((f, idx) => (
                  <div key={f.userId} className="flex items-center gap-3">
                    <span className={`font-disp font-bold text-sm w-8 ${T.faint}`}>{idx + 1}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${T.track}`}>
                      {f.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium">{f.username}</span>
                    <span className={`text-xs font-semibold ${T.sub}`}>{(f.xp || 0).toLocaleString()} XP</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : rankTab === 'guild' && !guildInfo ? (
          <p className={`text-sm ${T.faint}`}>You haven't joined a guild yet — head to the Guild tab to create or join one.</p>
        ) : (
          <div className="space-y-1.5">
            {rankList.map((p, idx) => {
              const medalColor =
                p.rank === 1 ? 'text-amber-400' : p.rank === 2 ? (dark ? 'text-slate-300' : 'text-slate-400') : p.rank === 3 ? 'text-orange-400' : T.faint;
              const prevRank = idx > 0 ? rankList[idx - 1].rank : p.rank;
              const showGap = idx > 0 && p.rank - prevRank > 1;
              return (
                <div key={`${rankTab}-${p.rank}-${p.name}`}>
                  {showGap && <div className={`text-center text-xs py-1 ${T.faint}`}>· · ·</div>}
                  <div
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                      p.isUser ? 'bg-amber-400 bg-opacity-10 border border-amber-400 border-opacity-30' : ''
                    }`}
                  >
                    <span className={`font-disp font-bold text-sm w-8 ${medalColor}`}>{p.rank}</span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        p.isUser ? 'bg-amber-400 text-slate-950' : T.track
                      }`}
                    >
                      {p.isUser ? username[0]?.toUpperCase() : p.name[0]}
                    </div>
                    <span className={`flex-1 text-sm ${p.isUser ? 'font-semibold' : 'font-medium'}`}>{p.isUser ? username : p.name}</span>
                    <span className={`text-xs font-semibold ${T.sub}`}>{p.xp.toLocaleString()} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  } else if (activeTab === 'guild') {
    mainContent = !guildInfo ? (
      <>
        <h1 className="font-disp font-bold text-2xl mb-4">Find a Guild</h1>

        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <Eyebrow className={`${T.faint} mb-2`}>Start Your Own</Eyebrow>
          <div className="flex gap-2">
            <input
              value={newGuildName}
              onChange={(e) => setNewGuildName(e.target.value)}
              placeholder="Guild name"
              className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
            />
            <button
              onClick={createGuild}
              disabled={guildBusy || !newGuildName.trim()}
              className="font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Or Join One</Eyebrow>
        <div className="space-y-2">
          {availableGuilds.length === 0 && (
            <p className={`text-sm ${T.faint}`}>No guilds exist yet — be the first to create one.</p>
          )}
          {availableGuilds.map((g) => (
            <div key={g.id} className={`flex items-center gap-3 rounded-xl border p-3 ${T.card} ${T.border}`}>
              <Users size={18} className={A.gold} />
              <span className="flex-1 text-sm font-medium">{g.name}</span>
              <button
                onClick={() => joinGuild(g.id, g.name)}
                disabled={guildBusy}
                className="font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </>
    ) : (
      <>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${T.card} ${T.border}`}>
            <Users size={26} className={A.gold} />
          </div>
          <div>
            <h1 className="font-disp font-bold text-2xl">{guildInfo.name}</h1>
            <p className={`text-sm ${T.sub}`}>{guildInfo.roster.length} member{guildInfo.roster.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {boss ? (
          <div className={`rounded-2xl border-l-4 border-rose-500 border ${T.card} ${T.border} p-4 mb-6`}>
            <div className="flex items-center gap-2 mb-2">
              <Swords size={16} className={A.rose} />
              <Eyebrow className={A.rose}>Guild Boss Battle</Eyebrow>
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-disp font-bold text-xl">{boss.name}</h2>
              <span className={`text-xs font-semibold ${T.sub}`}>Live</span>
            </div>
            <div className={`w-full h-3 rounded-full ${T.track} overflow-hidden mb-1`}>
              <div
                className="h-full rounded-full bg-rose-500"
                style={{ width: `${(boss.current_hp / boss.max_hp) * 100}%`, transition: 'width 500ms ease' }}
              />
            </div>
            <p className={`text-xs ${T.sub}`}>
              {boss.current_hp.toLocaleString()} / {boss.max_hp.toLocaleString()} HP · Reward: {boss.reward}
            </p>
          </div>
        ) : (
          <p className={`text-xs ${T.faint} mb-6`}>Boss battle data unavailable — run the boss_battles SQL to enable this.</p>
        )}

        <Eyebrow className={`${T.faint} mb-2`}>Roster</Eyebrow>
        <div className="space-y-1.5 mb-6">
          {guildInfo.roster.map((p, idx) => {
            const isMe = p.userId === userId;
            return (
              <div
                key={p.userId}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                  isMe ? 'bg-amber-400 bg-opacity-10 border border-amber-400 border-opacity-30' : ''
                }`}
              >
                <span className={`font-disp font-bold text-sm w-8 ${T.faint}`}>{idx + 1}</span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isMe ? 'bg-amber-400 text-slate-950' : T.track
                  }`}
                >
                  {(isMe ? username : p.username || '?')[0]?.toUpperCase()}
                </div>
                <span className={`flex-1 text-sm ${isMe ? 'font-semibold' : 'font-medium'}`}>{isMe ? username : p.username}</span>
                <span className={`text-xs font-semibold ${T.sub}`}>{(p.xp || 0).toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={leaveGuild}
          disabled={guildBusy}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${T.card} ${T.border} ${T.sub} disabled:opacity-50`}
        >
          Leave Guild
        </button>
      </>
    );
  } else if (activeTab === 'profile') {
    mainContent = (
      <>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center">
              <span className="font-disp font-bold text-3xl text-slate-950">{username[0]?.toUpperCase() || 'Y'}</span>
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                dark ? 'border-slate-950 bg-slate-900' : 'border-slate-50 bg-white'
              }`}
            >
              <span className="font-disp font-bold text-xs text-amber-400">{level}</span>
            </div>
          </div>
          <div>
            <h1 className="font-disp font-bold text-2xl">{username}</h1>
            <div className="flex items-center gap-1 mt-1">
              <Flame size={14} className={A.ember} />
              <span className={`text-sm ${T.sub}`}>{initialStreak} day streak</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {PROFILE_STATS.map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${T.card} ${T.border}`}>
              <div className="font-disp font-bold text-xl">{s.value}</div>
              <div className={`text-xs ${T.faint}`}>{s.label}</div>
            </div>
          ))}
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Badges</Eyebrow>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {BADGES.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 ${T.card} ${T.border} ${!b.unlocked ? 'opacity-40' : ''}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${b.unlocked ? 'bg-amber-400 bg-opacity-10' : T.track}`}>
                {b.unlocked ? <b.Icon size={22} className={A.gold} /> : <Lock size={18} className={T.faint} />}
              </div>
              <span className={`text-xs text-center font-medium ${b.unlocked ? T.text : T.faint}`}>{b.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onSignOut}
          className={`w-full flex items-center gap-3 rounded-xl border p-3 ${T.card} ${T.border}`}
        >
          <Settings size={18} className={T.sub} />
          <span className={`flex-1 text-left text-sm font-medium ${T.text}`}>Sign Out</span>
        </button>
      </>
    );
  }

  return (
    <div className={`min-h-screen w-full flex justify-center ${T.page} transition-colors duration-300`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        .font-disp { font-family: 'Rajdhani', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        @keyframes flicker { 0%,100%{ opacity:1; transform: scale(1);} 50%{ opacity:.85; transform: scale(1.05);} }
        .flame-pulse { animation: flicker 1.8s ease-in-out infinite; }
        @keyframes floatUp { 0%{ opacity:0; transform: translate(-50%,6px);} 15%{opacity:1; transform: translate(-50%,0);} 85%{opacity:1;} 100%{opacity:0; transform: translate(-50%,-16px);} }
        .toast-anim { animation: floatUp 1.5s ease forwards; }
        @keyframes confettiFall { 0%{ transform: translateY(0) rotate(0deg); opacity:1;} 100%{ transform: translateY(110vh) rotate(540deg); opacity:0;} }
        .confetti-piece { animation-name: confettiFall; animation-timing-function: ease-in; animation-fill-mode: forwards; }
      `}</style>

      <div className={`font-body relative w-full max-w-md ${T.bg} ${T.text} min-h-screen sm:min-h-0 sm:my-6 sm:rounded-3xl sm:shadow-2xl overflow-hidden`}>

        <div
          className="absolute top-0 left-0 right-0 h-56 pointer-events-none"
          style={{ background: dark ? 'radial-gradient(60% 100% at 50% 0%, rgba(251,191,36,0.10), transparent)' : 'radial-gradient(60% 100% at 50% 0%, rgba(251,191,36,0.15), transparent)' }}
        />

        {toast && (
          <div
            key={toast + Date.now()}
            className={`toast-anim fixed top-5 left-1/2 z-50 px-4 py-2 rounded-full font-disp font-bold text-sm tracking-wide border ${dark ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-amber-500 text-white border-amber-400'}`}
            style={{ boxShadow: '0 6px 24px rgba(251,191,36,0.4)' }}
          >
            {toast}
          </div>
        )}

        <Confetti active={confettiActive} />

        <div className="relative px-5 pt-5 pb-28">{mainContent}</div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40">
          <div className={`flex items-center justify-around border-t px-2 py-2.5 ${T.card} ${T.border} sm:rounded-b-3xl`}>
            {NAV.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)} className="flex flex-col items-center gap-1 px-2 py-1">
                  <Icon size={20} className={active ? 'text-amber-400' : T.faint} strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-xs font-medium ${active ? 'text-amber-400' : T.faint}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
