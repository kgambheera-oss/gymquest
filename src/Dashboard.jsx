import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { supabase } from './supabaseClient';
import {
  Zap, Flame, Sun, Moon, Bell, Dumbbell, ClipboardCheck, Camera,
  TrendingUp, CheckCircle2, Circle, Swords, Trophy, Users, ChevronRight,
  Home, Target, User, Calendar, Lock, Settings, Send, MessageCircle, Shield,
  Activity, Sparkles, X,
} from 'lucide-react';

/* ---------------------------------- mock data (not yet wired to the DB) ---------------------------------- */

const WEEKLY_QUESTS = [
  { id: 101, title: 'Complete 4 workouts', xp: 200, progress: 3, target: 4 },
  { id: 102, title: 'Log a new personal record', xp: 150, progress: 0, target: 1 },
  { id: 103, title: 'Log 20 total sets', xp: 100, progress: 14, target: 20 },
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

const NAV = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'quests', label: 'Quests', Icon: Target },
  { key: 'insights', label: 'Insights', Icon: Activity },
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

const SPLIT_OPTIONS = ['Push/Pull/Legs', 'Upper/Lower', 'Full Body', 'Bodybuilding', 'Powerlifting', 'Custom'];

const SPLIT_DAYS = {
  'Push/Pull/Legs': [
    { label: 'Push Day', muscles: 'Chest · Shoulders · Triceps' },
    { label: 'Pull Day', muscles: 'Back · Biceps · Rear Delts' },
    { label: 'Leg Day', muscles: 'Quads · Hamstrings · Glutes · Calves' },
  ],
  'Upper/Lower': [
    { label: 'Upper Day', muscles: 'Chest · Back · Shoulders · Arms' },
    { label: 'Lower Day', muscles: 'Quads · Hamstrings · Glutes · Calves' },
  ],
  'Full Body': [{ label: 'Full Body Day', muscles: 'Total-body compound lifts' }],
  Bodybuilding: [
    { label: 'Chest & Triceps', muscles: 'Chest · Triceps' },
    { label: 'Back & Biceps', muscles: 'Back · Biceps' },
    { label: 'Shoulders', muscles: 'Delts · Traps' },
    { label: 'Legs', muscles: 'Quads · Hamstrings · Glutes · Calves' },
  ],
  Powerlifting: [
    { label: 'Squat Day', muscles: 'Squat · Quad Accessories' },
    { label: 'Bench Day', muscles: 'Bench · Tricep Accessories' },
    { label: 'Deadlift Day', muscles: 'Deadlift · Back Accessories' },
  ],
  Custom: [{ label: 'Workout Day', muscles: 'Your custom plan' }],
};

function getWorkoutForDay(splitName, dayIndex) {
  const days = SPLIT_DAYS[splitName] || SPLIT_DAYS['Push/Pull/Legs'];
  const idx = ((dayIndex % days.length) + days.length) % days.length;
  return { ...days[idx], dayNumber: idx + 1, totalDays: days.length, splitName: splitName || 'Push/Pull/Legs' };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatMemberSince(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ------------------------------- rank tiers (replaces boss battles) --------------------- */

const RANK_TIERS = [
  { name: 'Bronze I', minLevel: 1, color: '#c2703d' },
  { name: 'Bronze II', minLevel: 3, color: '#c2703d' },
  { name: 'Bronze III', minLevel: 5, color: '#c2703d' },
  { name: 'Silver', minLevel: 7, color: '#a8b0bd' },
  { name: 'Gold', minLevel: 11, color: '#eab308' },
  { name: 'Platinum', minLevel: 16, color: '#2dd4bf' },
  { name: 'Diamond', minLevel: 21, color: '#818cf8' },
  { name: 'Elite', minLevel: 31, color: '#f43f5e' },
];

function getRank(level) {
  let rank = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (level >= tier.minLevel) rank = tier;
  }
  return rank;
}

function RankBadge({ level, size = 'sm' }) {
  const rank = getRank(level);
  const isElite = rank.name === 'Elite';
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm gap-1.5' : 'px-2 py-0.5 text-xs gap-1';
  return (
    <span
      className={`inline-flex items-center rounded-full font-disp font-bold ${sizeClasses} ${isElite ? 'elite-glow' : ''}`}
      style={{ backgroundColor: `${rank.color}22`, color: rank.color, border: `1px solid ${rank.color}66` }}
    >
      <Shield size={size === 'lg' ? 14 : 11} fill={rank.color} fillOpacity={0.3} />
      {rank.name}
    </span>
  );
}

function Heatmap({ completedDates, dark }) {
  const cells = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({ date: dateStr, completed: completedDates.includes(dateStr), dow: d.getDay() });
  }
  const firstDow = cells[0].dow;
  const padded = Array(firstDow).fill(null).concat(cells);
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  const emptyColor = dark ? '#1e293b' : '#e2e8f0';

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1 shrink-0">
          {week.map((day, di) => (
            <div
              key={di}
              className="rounded-sm"
              style={{ width: 10, height: 10, backgroundColor: !day ? 'transparent' : day.completed ? '#a78bfa' : emptyColor }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function generateCoachTips({ streak, stats, doneToday, totalToday, weeklyStats, level }) {
  const tips = [];

  const weakest = [...stats].sort((a, b) => a.value - b.value)[0];
  if (weakest && weakest.value < 40) {
    const hint = weakest.key === 'END' ? 'cardio' : weakest.key === 'STAM' ? 'bodyweight' : weakest.key === 'PWR' ? 'explosive' : 'strength';
    tips.push(`Your ${weakest.label} score is your lowest attribute (${weakest.value}) — log a few ${hint} sets to bring it up.`);
  }

  if (streak === 0) {
    tips.push("You don't have an active streak right now — completing today's workout starts a new one.");
  } else if (streak >= 3) {
    tips.push(`${streak}-day streak going — miss a day and it resets, so keep the chain alive.`);
  }

  if (doneToday < totalToday) {
    const left = totalToday - doneToday;
    tips.push(`You've got ${left} quest${left === 1 ? '' : 's'} left today — finish them before you log off.`);
  }

  if (weeklyStats.workoutsThisWeek <= 2) {
    tips.push(`Only ${weeklyStats.workoutsThisWeek} workout${weeklyStats.workoutsThisWeek === 1 ? '' : 's'} logged this week — aim for 3-4 to build real momentum.`);
  } else if (weeklyStats.workoutsThisWeek >= 5) {
    tips.push(`${weeklyStats.workoutsThisWeek} workouts this week — strong week, make sure you're recovering too.`);
  }

  const nextTier = RANK_TIERS.find((t) => t.minLevel > level);
  if (nextTier) {
    const gap = nextTier.minLevel - level;
    tips.push(`${gap} more level${gap === 1 ? '' : 's'} to reach ${nextTier.name}.`);
  }

  return tips.slice(0, 4);
}

/* --------------------------- exercise catalog (preset + custom) ------------------------- */

const EXERCISES = [
  { name: 'Bench Press', category: 'strength' },
  { name: 'Incline Bench Press', category: 'strength' },
  { name: 'Decline Bench Press', category: 'strength' },
  { name: 'Dumbbell Bench Press', category: 'strength' },
  { name: 'Dumbbell Incline Press', category: 'strength' },
  { name: 'Chest Fly', category: 'strength' },
  { name: 'Cable Fly', category: 'strength' },
  { name: 'Squat', category: 'strength' },
  { name: 'Front Squat', category: 'strength' },
  { name: 'Goblet Squat', category: 'strength' },
  { name: 'Leg Press', category: 'strength' },
  { name: 'Lunges', category: 'strength' },
  { name: 'Bulgarian Split Squat', category: 'strength' },
  { name: 'Leg Extension', category: 'strength' },
  { name: 'Leg Curl', category: 'strength' },
  { name: 'Calf Raise', category: 'strength' },
  { name: 'Deadlift', category: 'strength' },
  { name: 'Romanian Deadlift', category: 'strength' },
  { name: 'Sumo Deadlift', category: 'strength' },
  { name: 'Hip Thrust', category: 'strength' },
  { name: 'Barbell Row', category: 'strength' },
  { name: 'T-Bar Row', category: 'strength' },
  { name: 'Single-Arm Dumbbell Row', category: 'strength' },
  { name: 'Seated Cable Row', category: 'strength' },
  { name: 'Lat Pulldown', category: 'strength' },
  { name: 'Face Pull', category: 'strength' },
  { name: 'Shrugs', category: 'strength' },
  { name: 'Overhead Press', category: 'strength' },
  { name: 'Dumbbell Shoulder Press', category: 'strength' },
  { name: 'Arnold Press', category: 'strength' },
  { name: 'Lateral Raise', category: 'strength' },
  { name: 'Front Raise', category: 'strength' },
  { name: 'Rear Delt Fly', category: 'strength' },
  { name: 'Upright Row', category: 'strength' },
  { name: 'Close-Grip Bench Press', category: 'strength' },
  { name: 'Bicep Curl', category: 'strength' },
  { name: 'Hammer Curl', category: 'strength' },
  { name: 'Barbell Curl', category: 'strength' },
  { name: 'Preacher Curl', category: 'strength' },
  { name: 'Tricep Extension', category: 'strength' },
  { name: 'Skull Crushers', category: 'strength' },
  { name: 'Tricep Pushdown', category: 'strength' },
  { name: 'Power Clean', category: 'power' },
  { name: 'Clean and Jerk', category: 'power' },
  { name: 'Snatch', category: 'power' },
  { name: 'Hang Clean', category: 'power' },
  { name: 'Push Press', category: 'power' },
  { name: 'Box Jump', category: 'power' },
  { name: 'Kettlebell Swing', category: 'power' },
  { name: 'Medicine Ball Slam', category: 'power' },
  { name: 'Running', category: 'endurance' },
  { name: 'Rowing (Cardio)', category: 'endurance' },
  { name: 'Assault Bike', category: 'endurance' },
  { name: 'Jump Rope', category: 'endurance' },
  { name: 'Battle Ropes', category: 'endurance' },
  { name: 'Burpees', category: 'endurance' },
  { name: 'Stair Climber', category: 'endurance' },
  { name: 'Elliptical', category: 'endurance' },
  { name: 'Pull-Up', category: 'stamina' },
  { name: 'Chin-Up', category: 'stamina' },
  { name: 'Push-Up', category: 'stamina' },
  { name: 'Dips', category: 'stamina' },
  { name: 'Plank', category: 'stamina' },
  { name: 'Sit-Up', category: 'stamina' },
  { name: 'Crunch', category: 'stamina' },
  { name: 'Hanging Leg Raise', category: 'stamina' },
  { name: 'Russian Twist', category: 'stamina' },
  { name: 'Mountain Climbers', category: 'stamina' },
  { name: 'Bodyweight Squats', category: 'stamina' },
  { name: 'Ab Wheel Rollout', category: 'stamina' },
  { name: 'Cable Crunch', category: 'stamina' },
];

function scoreFromVolume(vol) {
  return Math.min(100, Math.round((vol / 200) * 100));
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
  const colors = ['#a78bfa', '#fb923c', '#22d3ee', '#f43f5e', '#34d399'];
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

function HeroQuestCard({ quest, onComplete, T, A, dark, compact, eyebrowText, subtitleText, titleText }) {
  if (!quest) return null;
  return (
    <div className={`relative rounded-2xl border-l-4 border-violet-400 border ${T.card} ${T.border} p-4 ${compact ? 'mb-3' : 'mb-6'} overflow-hidden`}>
      <Eyebrow className={A.primary}>{eyebrowText}</Eyebrow>
      <div className="flex items-center justify-between mt-1">
        <h2 className={`font-disp font-bold ${compact ? 'text-xl' : 'text-2xl'}`}>{titleText || quest.title}</h2>
        <Dumbbell size={compact ? 22 : 26} className={dark ? 'text-slate-700' : 'text-slate-300'} />
      </div>
      <p className={`text-sm ${T.sub} mt-1`}>{subtitleText}</p>
      <div className={`flex items-center justify-between ${compact ? 'mt-3' : 'mt-4'}`}>
        <span className={`font-disp font-bold text-sm ${A.primary}`}>+{quest.xp_reward} XP</span>
        <button
          onClick={onComplete}
          disabled={quest.done}
          className={`font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 ${
            quest.done ? 'bg-emerald-500 bg-opacity-20 text-emerald-400' : 'bg-violet-400 text-slate-950 hover:bg-violet-300'
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
  const rowClass = `w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${T.card} ${T.border}`;

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
  initialLongestStreak = 0,
  initialWorkoutCount = 0,
  createdAt = null,
  username = 'You',
  initialSplit = 'Push/Pull/Legs',
  initialSplitDayIndex = 0,
  initialQuests = [],
  initialGuild = null,
  initialAvailableGuilds = [],
  initialFriends = [],
  initialFriendRequests = [],
  initialOutgoingIds = [],
  initialActivity = [],
  initialAttributeCounts = { strength: 0, power: 0, endurance: 0, stamina: 0 },
  initialDisciplineCount = 0,
  initialCompletedDates = [],
  initialWeeklyStats = { workoutsThisWeek: 0, xpThisWeek: 0, completionRate: 0, liftsThisWeek: 0 },
  initialCheckinPhotos = [],
  onSignOut,
}) {
  const [dark, setDark] = useState(true);
  const [quests, setQuests] = useState(initialQuests);
  const [xp, setXp] = useState(initialXp);
  const [level, setLevel] = useState(initialLevel);
  const [streak, setStreak] = useState(initialStreak);
  const [longestStreak, setLongestStreak] = useState(initialLongestStreak);
  const [workoutCount, setWorkoutCount] = useState(initialWorkoutCount);
  const [split, setSplit] = useState(initialSplit);
  const [splitDayIndex, setSplitDayIndex] = useState(initialSplitDayIndex);
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
  const [activity, setActivity] = useState(initialActivity);
  const [guildMessages, setGuildMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [attributeCounts, setAttributeCounts] = useState(initialAttributeCounts);
  const [disciplineCount, setDisciplineCount] = useState(initialDisciplineCount);
  const [completedDates] = useState(initialCompletedDates);
  const [weeklyStats, setWeeklyStats] = useState(initialWeeklyStats);
  const [checkinPhotos, setCheckinPhotos] = useState(initialCheckinPhotos);
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0].name);
  const [customExercise, setCustomExercise] = useState('');
  const [logWeight, setLogWeight] = useState('');
  const [logReps, setLogReps] = useState('');
  const [logSets, setLogSets] = useState('1');
  const [logBusy, setLogBusy] = useState(false);
  const toastTimer = useRef(null);

  const T = dark
    ? { page: 'bg-black', bg: 'bg-slate-950', card: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-50', sub: 'text-slate-400', faint: 'text-slate-500', track: 'bg-slate-800' }
    : { page: 'bg-slate-300', bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', sub: 'text-slate-500', faint: 'text-slate-400', track: 'bg-slate-200' };

  const A = dark
    ? { primary: 'text-violet-400', ember: 'text-orange-400', cyan: 'text-cyan-400', rose: 'text-rose-400' }
    : { primary: 'text-violet-600', ember: 'text-orange-600', cyan: 'text-cyan-600', rose: 'text-rose-600' };

  const fireToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  };

  const logActivity = (action) => {
    supabase
      .from('activity_log')
      .insert({ user_id: userId, action })
      .then(({ error }) => {
        if (error) console.error('Failed to log activity:', error);
      });
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
      const oldRank = getRank(level);
      const newRank = getRank(newLevel);
      fireToast(newRank.name !== oldRank.name ? `RANK UP: ${newRank.name}!` : 'LEVEL UP!');
      celebrateLevelUp();
      logActivity(`reached Level ${newLevel}`);
    } else if (delta > 0) {
      fireToast(`+${delta} XP`);
    }
    if (delta > 0) {
      setWeeklyStats((w) => ({ ...w, xpThisWeek: w.xpThisWeek + delta }));
    }
    supabase
      .from('profiles')
      .update({ xp: next, level: newLevel })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('Failed to save XP:', error);
      });
  };

  const updateStreak = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('streak, longest_streak, last_active_date')
      .eq('id', userId)
      .single();
    if (!profileRow || profileRow.last_active_date === today) return;

    let newStreak;
    if (profileRow.last_active_date) {
      const diffDays = Math.round((new Date(today) - new Date(profileRow.last_active_date)) / 86400000);
      newStreak = diffDays === 1 ? (profileRow.streak || 0) + 1 : 1;
    } else {
      newStreak = 1;
    }
    const newLongest = Math.max(newStreak, profileRow.longest_streak || 0);

    setStreak(newStreak);
    setLongestStreak(newLongest);
    setWorkoutCount((c) => c + 1);

    await supabase
      .from('profiles')
      .update({ streak: newStreak, longest_streak: newLongest, last_active_date: today })
      .eq('id', userId);

    if (newStreak > 1) logActivity(`hit a ${newStreak}-day streak`);
  };

  const toggleQuest = (quest) => {
    if (quest.kind === 'hero' && quest.done) return;
    const newDone = !quest.done;
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, done: newDone } : q)));
    applyXP(newDone ? quest.xp_reward : -quest.xp_reward);
    if (newDone) setDisciplineCount((c) => c + 1);
    supabase
      .from('quests')
      .update({ done: newDone })
      .eq('id', quest.id)
      .then(({ error }) => {
        if (error) console.error('Failed to save quest:', error);
      });
    if (quest.kind === 'hero' && newDone) {
      logActivity(`crushed ${quest.title}`);
      updateStreak();
      setWeeklyStats((w) => ({ ...w, workoutsThisWeek: w.workoutsThisWeek + 1 }));
    } else if (newDone && quest.title === 'Beat a previous PR') {
      logActivity('hit a new PR');
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
    setDisciplineCount((c) => c + 1);
    await supabase.from('quests').update({ done: true, photo_url: photoUrl }).eq('id', quest.id);
    await supabase.from('checkins').insert({ user_id: userId, photo_url: photoUrl });
    logActivity('checked in with a gym photo');
    setUploadingId(null);
  };

  const deleteCheckinPhoto = async (photo) => {
    if (!window.confirm('Delete this photo? This can\'t be undone.')) return;
    const path = photo.photo_url.split('/checkins/')[1];
    if (path) {
      await supabase.storage.from('checkins').remove([path]);
    }
    await supabase.from('checkins').delete().eq('id', photo.id);
    setCheckinPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    fireToast('Photo deleted');
  };

  const logLift = async () => {
    const exerciseName = selectedExercise === '__custom__' ? customExercise.trim() : selectedExercise;
    const reps = parseInt(logReps, 10) || 0;
    const sets = parseInt(logSets, 10) || 1;
    const weight = parseFloat(logWeight) || 0;
    if (!exerciseName || reps <= 0) {
      fireToast('Add reps at least');
      return;
    }
    setLogBusy(true);
    const category = EXERCISES.find((e) => e.name === exerciseName)?.category || 'strength';

    const { data: prevBest } = await supabase
      .from('exercise_logs')
      .select('weight')
      .eq('user_id', userId)
      .eq('exercise', exerciseName)
      .order('weight', { ascending: false })
      .limit(1)
      .maybeSingle();
    const isPR = weight > 0 && (!prevBest || weight > prevBest.weight);

    const { error } = await supabase.from('exercise_logs').insert({ user_id: userId, exercise: exerciseName, category, weight, reps, sets });
    if (error) {
      fireToast('Could not log lift');
      setLogBusy(false);
      return;
    }

    setAttributeCounts((prev) => ({ ...prev, [category]: (prev[category] || 0) + reps * sets }));
    fireToast(isPR ? `New PR: ${exerciseName}!` : `${exerciseName} logged`);
    logActivity(isPR ? `hit a new PR on ${exerciseName}` : `logged ${exerciseName}`);

    if (isPR) {
      const prQuest = quests.find((q) => q.title === 'Beat a previous PR');
      if (prQuest && !prQuest.done) toggleQuest(prQuest);
    }

    setLogWeight('');
    setLogReps('');
    setCustomExercise('');
    setLogBusy(false);
  };

  const fetchRoster = async (guildId) => {
    const { data: rosterRows } = await supabase
      .from('guild_members')
      .select('user_id, profiles ( username, level, xp )')
      .eq('guild_id', guildId);
    return (rosterRows || [])
      .map((r) => ({ userId: r.user_id, username: r.profiles?.username, level: r.profiles?.level || 1, xp: r.profiles?.xp || 0 }))
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
    logActivity(`joined ${guildName}`);
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
    setGuildMessages([]);
    const { data: guildsList } = await supabase.from('guilds').select('id, name');
    setAvailableGuilds(guildsList || []);
    setGuildBusy(false);
  };

  const loadGuildMessages = async (guildId) => {
    const { data } = await supabase
      .from('guild_messages')
      .select('id, user_id, message, created_at, profiles ( username )')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true })
      .limit(50);
    setGuildMessages(
      (data || []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        username: m.profiles?.username || '?',
        message: m.message,
        time: timeAgo(m.created_at),
      }))
    );
  };

  const sendGuildMessage = async () => {
    if (!chatInput.trim() || !guildInfo) return;
    setChatBusy(true);
    const { error } = await supabase.from('guild_messages').insert({ guild_id: guildInfo.id, user_id: userId, message: chatInput.trim() });
    if (!error) {
      setChatInput('');
      await loadGuildMessages(guildInfo.id);
    } else {
      fireToast('Message failed to send');
    }
    setChatBusy(false);
  };

  useEffect(() => {
    if (activeTab === 'guild' && guildInfo) {
      loadGuildMessages(guildInfo.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, guildInfo?.id]);

  const searchUsers = async () => {
    const q = friendSearch.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, level')
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

  const changeSplit = async (newSplit) => {
    setSplit(newSplit);
    setSplitDayIndex(0);
    await supabase.from('profiles').update({ split: newSplit, split_day_index: 0 }).eq('id', userId);
    fireToast('Split updated!');
  };

  const heroQuest = quests.find((q) => q.kind === 'hero');
  const sideQuests = quests.filter((q) => q.kind !== 'hero');
  const totalToday = quests.length || 1;
  const doneToday = quests.filter((q) => q.done).length;

  const todaysWorkout = getWorkoutForDay(split, splitDayIndex);
  const heroEyebrow = `${split} · Day ${todaysWorkout.dayNumber}/${todaysWorkout.totalDays}`;
  const myRank = getRank(level);

  const rival =
    friends.length > 0 ? friends.reduce((closest, f) => (Math.abs(f.xp - xp) < Math.abs(closest.xp - xp) ? f : closest), friends[0]) : null;
  const rivalTotal = rival ? xp + rival.xp : 0;
  const rivalSplit = rival && rivalTotal > 0 ? { you: (xp / rivalTotal) * 100, rival: (rival.xp / rivalTotal) * 100 } : { you: 50, rival: 50 };

  const STATS = [
    { key: 'STR', label: 'Strength', value: scoreFromVolume(attributeCounts.strength || 0) },
    { key: 'PWR', label: 'Power', value: scoreFromVolume(attributeCounts.power || 0) },
    { key: 'END', label: 'Endurance', value: scoreFromVolume(attributeCounts.endurance || 0) },
    { key: 'DISC', label: 'Discipline', value: Math.min(100, Math.round((disciplineCount / 30) * 100)) },
    { key: 'STAM', label: 'Stamina', value: scoreFromVolume(attributeCounts.stamina || 0) },
  ];
  const totalXpAllTime = (level - 1) * XP_PER_LEVEL + xp;
  const PROFILE_STATS = [
    { label: 'Workouts', value: String(workoutCount) },
    { label: 'Longest Streak', value: `${longestStreak}d` },
    { label: 'Total XP', value: totalXpAllTime >= 1000 ? `${(totalXpAllTime / 1000).toFixed(1)}k` : String(totalXpAllTime) },
    { label: 'Member Since', value: formatMemberSince(createdAt) },
  ];

  const pct = Math.min(100, (xp / XP_PER_LEVEL) * 100);
  const grid25 = gridRing(STATS.length, 25);
  const grid50 = gridRing(STATS.length, 50);
  const grid75 = gridRing(STATS.length, 75);
  const grid100 = gridRing(STATS.length, 100);
  const statPoly = statPolygon(STATS);
  const statVerts = STATS.map((s, i) => pointAt(i, STATS.length, (R * s.value) / 100));
  const axisEnds = STATS.map((_, i) => pointAt(i, STATS.length, R));
  const labelPts = STATS.map((_, i) => pointAt(i, STATS.length, R + 28));
  const coachTips = generateCoachTips({ streak, stats: STATS, doneToday, totalToday, weeklyStats, level });
  const rankList =
    rankTab === 'guild'
      ? guildInfo
        ? guildInfo.roster.map((p, idx) => ({
            rank: idx + 1,
            name: p.userId === userId ? username : p.username,
            xp: p.xp,
            level: p.userId === userId ? level : p.level,
            isUser: p.userId === userId,
          }))
        : []
      : rankTab === 'friends'
      ? []
      : RANKS_DATA[rankTab];
  const friendBoard = [...friends.map((f) => ({ ...f })), { userId, username, xp, level }].sort((a, b) => b.xp - a.xp);

  let mainContent = null;

  if (activeTab === 'home') {
    mainContent = (
      <>
        {/* ---------- top bar ---------- */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-400 flex items-center justify-center">
              <Zap size={19} className="text-slate-950" strokeWidth={2.5} fill="currentColor" />
            </div>
            <span className="font-disp font-bold text-xl tracking-tight">GymQuest</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${T.card} ${T.border}`}
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
        <div className="flex items-stretch gap-3 mb-3">
          <div className={`flex-1 rounded-2xl border ${T.card} ${T.border} p-3 flex items-center gap-3`}>
            <div className="w-11 h-11 rounded-xl bg-orange-500 bg-opacity-10 flex items-center justify-center" style={{ boxShadow: dark ? '0 0 18px rgba(251,146,60,0.25)' : 'none' }}>
              <Flame size={22} className={`flame-pulse ${A.ember}`} fill="currentColor" />
            </div>
            <div>
              <div className="font-disp font-bold text-xl leading-none">{streak}</div>
              <div className={`text-xs ${T.sub} mt-0.5`}>day streak</div>
            </div>
          </div>

          <div className={`rounded-2xl border ${T.card} ${T.border} p-3 flex items-center gap-3`}>
            <div className="relative w-12 h-12 shrink-0">
              <ProgressRing pct={pct} size={48} stroke={4} colorClass="stroke-violet-400" trackClass={dark ? 'stroke-slate-800' : 'stroke-slate-200'} />
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

        <div className="mb-4">
          <RankBadge level={level} />
        </div>

        <div className={`w-full h-2 rounded-full ${T.track} overflow-hidden mb-6`}>
          <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct}%`, transition: 'width 500ms ease' }} />
        </div>

        <HeroQuestCard
          quest={heroQuest}
          onComplete={completeHero}
          T={T}
          A={A}
          dark={dark}
          eyebrowText={heroEyebrow}
          subtitleText={todaysWorkout.muscles}
          titleText={todaysWorkout.label}
        />

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
            <polygon points={statPoly} className="fill-cyan-400 stroke-cyan-400" fillOpacity="0.28" strokeWidth="2" style={{ transition: 'all 500ms ease' }} />
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
          <p className={`text-xs ${T.faint} mt-2`}>Built from your logged lifts and completed quests — log more to grow these.</p>
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
        {rival ? (
          <div className={`rounded-2xl border-l-4 border-rose-500 border ${T.card} ${T.border} p-4 mb-6`}>
            <div className="flex items-center gap-2 mb-3">
              <Swords size={16} className={A.rose} />
              <Eyebrow className={A.rose}>Rival Watch</Eyebrow>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold mb-1.5">
              <span>{username} · {xp.toLocaleString()} XP</span>
              <span>{rival.username} · {rival.xp.toLocaleString()} XP</span>
            </div>
            <div className={`w-full h-2.5 rounded-full ${T.track} overflow-hidden flex`}>
              <div className="h-full bg-cyan-400" style={{ width: `${rivalSplit.you}%`, transition: 'width 500ms ease' }} />
              <div className="h-full bg-rose-500" style={{ width: `${rivalSplit.rival}%`, transition: 'width 500ms ease' }} />
            </div>
            <p className={`text-xs ${T.sub} mt-2`}>
              {xp === rival.xp
                ? "Dead even — next session breaks the tie."
                : xp > rival.xp
                ? `You're ahead of ${rival.username} by ${(xp - rival.xp).toLocaleString()} XP.`
                : `${rival.username} is ahead by ${(rival.xp - xp).toLocaleString()} XP — close the gap.`}
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
            <Eyebrow className={`${T.faint} mb-1`}>Rival Watch</Eyebrow>
            <p className={`text-sm ${T.faint}`}>Add a friend from the Ranks tab to get a rival.</p>
          </div>
        )}

        {/* ---------- leaderboard ---------- */}
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className={A.primary} />
              <Eyebrow className={A.primary}>Friend Leaderboard</Eyebrow>
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
                    className={`flex items-center gap-3 rounded-lg ${isMe ? '-mx-1 px-1 py-1 bg-violet-400 bg-opacity-10 border border-violet-400 border-opacity-30' : ''}`}
                  >
                    <span className={`font-disp font-bold text-sm w-5 ${isMe ? 'text-violet-400' : T.faint}`}>{idx + 1}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? 'bg-violet-400 text-slate-950' : T.track}`}>
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <span className={`flex-1 text-sm ${isMe ? 'font-semibold' : 'font-medium'}`}>{p.username}</span>
                    <RankBadge level={p.level || 1} />
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
          {activity.length === 0 ? (
            <p className={`text-sm ${T.faint}`}>No activity yet — complete a quest or add friends to see it here.</p>
          ) : (
            <div className="space-y-2.5">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${T.track}`}>
                    {a.username?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm flex-1">
                    <span className="font-semibold">{a.username}</span>{' '}
                    <span className={T.sub}>{a.action}</span>
                  </p>
                  <span className={`text-xs shrink-0 ${T.faint}`}>{a.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- season banner ---------- */}
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4`}>
          <Eyebrow className={A.primary}>Seasonal Competition</Eyebrow>
          <p className={`text-sm ${T.faint} mt-1`}>Coming soon — seasons will track everyone's ranking over a real competition window.</p>
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
              className="h-full rounded-full bg-violet-400"
              style={{ width: `${Math.min(100, (doneToday / totalToday) * 100)}%`, transition: 'width 400ms ease' }}
            />
          </div>
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Today</Eyebrow>
        <HeroQuestCard
          quest={heroQuest}
          onComplete={completeHero}
          T={T}
          A={A}
          dark={dark}
          compact
          eyebrowText={heroEyebrow}
          subtitleText={todaysWorkout.muscles}
          titleText={todaysWorkout.label}
        />

        <div className="space-y-2 mb-6">
          {sideQuests.map((q) => (
            <QuestRow key={q.id} quest={q} onToggle={toggleQuest} onPhotoChange={handlePhotoUpload} uploading={uploadingId === q.id} T={T} />
          ))}
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Log a Lift</Eyebrow>
        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className={`w-full rounded-xl border px-3 py-2 text-sm mb-2 outline-none ${T.card} ${T.border} ${T.text}`}
          >
            {EXERCISES.map((ex) => (
              <option key={ex.name} value={ex.name}>
                {ex.name}
              </option>
            ))}
            <option value="__custom__">Custom exercise...</option>
          </select>
          {selectedExercise === '__custom__' && (
            <input
              value={customExercise}
              onChange={(e) => setCustomExercise(e.target.value)}
              placeholder="Exercise name"
              className={`w-full rounded-xl border px-3 py-2 text-sm mb-2 outline-none ${T.card} ${T.border} ${T.text}`}
            />
          )}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              type="number"
              value={logWeight}
              onChange={(e) => setLogWeight(e.target.value)}
              placeholder="Weight"
              className={`rounded-xl border px-2 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
            />
            <input
              type="number"
              value={logReps}
              onChange={(e) => setLogReps(e.target.value)}
              placeholder="Reps"
              className={`rounded-xl border px-2 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
            />
            <input
              type="number"
              value={logSets}
              onChange={(e) => setLogSets(e.target.value)}
              placeholder="Sets"
              className={`rounded-xl border px-2 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
            />
          </div>
          <button
            onClick={logLift}
            disabled={logBusy}
            className="w-full font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl bg-violet-400 text-slate-950 hover:bg-violet-300 transition-all active:scale-95 disabled:opacity-50"
          >
            Log It
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className={A.primary} />
          <Eyebrow className={A.primary}>This Week</Eyebrow>
        </div>
        <div className="space-y-2">
          {WEEKLY_QUESTS.map((w) => (
            <div key={w.id} className={`rounded-xl border p-3 ${T.card} ${T.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{w.title}</span>
                <span className={`font-disp text-xs font-bold ${T.faint}`}>+{w.xp}</span>
              </div>
              <div className={`w-full h-2 rounded-full ${T.track} overflow-hidden mb-1`}>
                <div
                  className="h-full rounded-full bg-violet-400"
                  style={{ width: `${Math.min(100, (w.progress / w.target) * 100)}%` }}
                />
              </div>
              <span className={`text-xs ${T.faint}`}>{w.progress}/{w.target}</span>
            </div>
          ))}
        </div>
      </>
    );
  } else if (activeTab === 'insights') {
    mainContent = (
      <>
        <h1 className="font-disp font-bold text-2xl mb-4">Insights</h1>

        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <Eyebrow className={A.primary}>Weekly Report</Eyebrow>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <div className="font-disp font-bold text-2xl">{weeklyStats.workoutsThisWeek}/7</div>
              <div className={`text-xs ${T.faint}`}>Workouts</div>
            </div>
            <div>
              <div className="font-disp font-bold text-2xl text-violet-400">{weeklyStats.xpThisWeek}</div>
              <div className={`text-xs ${T.faint}`}>XP Earned</div>
            </div>
            <div>
              <div className="font-disp font-bold text-2xl">{weeklyStats.liftsThisWeek}</div>
              <div className={`text-xs ${T.faint}`}>Lifts Logged</div>
            </div>
            <div>
              <div className="font-disp font-bold text-2xl">{weeklyStats.completionRate}%</div>
              <div className={`text-xs ${T.faint}`}>Quest Completion</div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border ${T.card} ${T.border} p-4 mb-6`}>
          <Eyebrow className={`${T.faint} mb-2`}>Consistency — Last 12 Weeks</Eyebrow>
          <Heatmap completedDates={completedDates} dark={dark} />
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs ${T.faint}`}>Less</span>
            <div className="rounded-sm" style={{ width: 10, height: 10, backgroundColor: dark ? '#1e293b' : '#e2e8f0' }} />
            <div className="rounded-sm" style={{ width: 10, height: 10, backgroundColor: '#a78bfa' }} />
            <span className={`text-xs ${T.faint}`}>More</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className={A.primary} />
            <Eyebrow className={A.primary}>Coach</Eyebrow>
          </div>
          <p className={`text-xs ${T.faint} mb-2`}>Personalized tips computed from your real stats — not a chatbot, just smart math.</p>
          <div className="space-y-2">
            {coachTips.length === 0 ? (
              <div className={`rounded-xl border p-3 ${T.card} ${T.border} text-sm ${T.sub}`}>You're on track — nothing urgent right now.</div>
            ) : (
              coachTips.map((tip, i) => (
                <div key={i} className={`rounded-xl border p-3 ${T.card} ${T.border} text-sm`}>
                  {tip}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <Eyebrow className={`${T.faint} mb-2`}>Transformation Timeline</Eyebrow>
          {checkinPhotos.length === 0 ? (
            <p className={`text-sm ${T.faint}`}>No check-in photos yet — complete the Gym Photo Check-in quest to start your timeline.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {checkinPhotos.map((c) => (
                <div key={c.id} className="shrink-0 text-center relative">
                  <img src={c.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  <button
                    onClick={() => deleteCheckinPhoto(c)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"
                    aria-label="Delete photo"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                  <span className={`text-xs ${T.faint} mt-1 block`}>
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
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
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all active:scale-95 ${
                rankTab === key ? 'bg-violet-400 text-slate-950' : T.sub
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
                  className="font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl bg-violet-400 text-slate-950 hover:bg-violet-300 transition-all active:scale-95 disabled:opacity-50"
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
                        <RankBadge level={u.level || 1} />
                        <button
                          onClick={() => sendFriendRequest(u.id)}
                          disabled={alreadyFriend || requested}
                          className="font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg bg-violet-400 text-slate-950 disabled:opacity-50"
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
                    <RankBadge level={f.level || 1} />
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
                p.rank === 1 ? 'text-violet-400' : p.rank === 2 ? (dark ? 'text-slate-300' : 'text-slate-400') : p.rank === 3 ? 'text-orange-400' : T.faint;
              const prevRank = idx > 0 ? rankList[idx - 1].rank : p.rank;
              const showGap = idx > 0 && p.rank - prevRank > 1;
              return (
                <div key={`${rankTab}-${p.rank}-${p.name}`}>
                  {showGap && <div className={`text-center text-xs py-1 ${T.faint}`}>· · ·</div>}
                  <div
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                      p.isUser ? 'bg-violet-400 bg-opacity-10 border border-violet-400 border-opacity-30' : ''
                    }`}
                  >
                    <span className={`font-disp font-bold text-sm w-8 ${medalColor}`}>{p.rank}</span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        p.isUser ? 'bg-violet-400 text-slate-950' : T.track
                      }`}
                    >
                      {p.isUser ? username[0]?.toUpperCase() : p.name[0]}
                    </div>
                    <span className={`flex-1 text-sm ${p.isUser ? 'font-semibold' : 'font-medium'}`}>{p.isUser ? username : p.name}</span>
                    {p.level && <RankBadge level={p.level} />}
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
              className="font-disp font-bold text-sm uppercase tracking-wide px-4 py-2 rounded-xl bg-violet-400 text-slate-950 hover:bg-violet-300 transition-all active:scale-95 disabled:opacity-50"
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
              <Users size={18} className={A.primary} />
              <span className="flex-1 text-sm font-medium">{g.name}</span>
              <button
                onClick={() => joinGuild(g.id, g.name)}
                disabled={guildBusy}
                className="font-disp font-bold text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg bg-violet-400 text-slate-950 hover:bg-violet-300 transition-all active:scale-95 disabled:opacity-50"
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
            <Users size={26} className={A.primary} />
          </div>
          <div>
            <h1 className="font-disp font-bold text-2xl">{guildInfo.name}</h1>
            <p className={`text-sm ${T.sub}`}>{guildInfo.roster.length} member{guildInfo.roster.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Roster</Eyebrow>
        <div className="space-y-1.5 mb-6">
          {guildInfo.roster.map((p, idx) => {
            const isMe = p.userId === userId;
            return (
              <div
                key={p.userId}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                  isMe ? 'bg-violet-400 bg-opacity-10 border border-violet-400 border-opacity-30' : ''
                }`}
              >
                <span className={`font-disp font-bold text-sm w-8 ${T.faint}`}>{idx + 1}</span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isMe ? 'bg-violet-400 text-slate-950' : T.track
                  }`}
                >
                  {(isMe ? username : p.username || '?')[0]?.toUpperCase()}
                </div>
                <span className={`flex-1 text-sm ${isMe ? 'font-semibold' : 'font-medium'}`}>{isMe ? username : p.username}</span>
                <RankBadge level={isMe ? level : p.level || 1} />
                <span className={`text-xs font-semibold ${T.sub}`}>{(isMe ? xp : p.xp || 0).toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <MessageCircle size={16} className={A.primary} />
          <Eyebrow className={A.primary}>Guild Chat</Eyebrow>
        </div>
        <div className={`rounded-2xl border ${T.card} ${T.border} p-3 mb-4`}>
          <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
            {guildMessages.length === 0 ? (
              <p className={`text-sm ${T.faint} text-center py-4`}>No messages yet — silence... the gains are judging you.</p>
            ) : (
              guildMessages.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${T.track}`}>
                    {m.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold">{m.username}</span>{' '}
                    <span className={`text-xs ${T.faint}`}>{m.time}</span>
                    <p className="text-sm break-words">{m.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendGuildMessage()}
              placeholder="Say something..."
              className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${T.card} ${T.border} ${T.text}`}
            />
            <button
              onClick={sendGuildMessage}
              disabled={chatBusy || !chatInput.trim()}
              className="rounded-xl px-3 bg-violet-400 text-slate-950 disabled:opacity-50 flex items-center justify-center transition-all active:scale-90"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={leaveGuild}
          disabled={guildBusy}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all active:scale-95 ${T.card} ${T.border} ${T.sub} disabled:opacity-50`}
        >
          Leave Guild
        </button>
      </>
    );
  } else if (activeTab === 'profile') {
    mainContent = (
      <>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full bg-violet-400 flex items-center justify-center"
              style={{ boxShadow: `0 0 0 3px ${myRank.color}88` }}
            >
              <span className="font-disp font-bold text-3xl text-slate-950">{username[0]?.toUpperCase() || 'Y'}</span>
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                dark ? 'border-slate-950 bg-slate-900' : 'border-slate-50 bg-white'
              }`}
            >
              <span className="font-disp font-bold text-xs text-violet-400">{level}</span>
            </div>
          </div>
          <div>
            <h1 className="font-disp font-bold text-2xl">{username}</h1>
            <div className="flex items-center gap-1 mt-1">
              <Flame size={14} className={A.ember} />
              <span className={`text-sm ${T.sub}`}>{streak} day streak</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <RankBadge level={level} size="lg" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {PROFILE_STATS.map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${T.card} ${T.border}`}>
              <div className="font-disp font-bold text-xl">{s.value}</div>
              <div className={`text-xs ${T.faint}`}>{s.label}</div>
            </div>
          ))}
        </div>

        <Eyebrow className={`${T.faint} mb-2`}>Workout Split</Eyebrow>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {SPLIT_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => changeSplit(s)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium text-left transition-all active:scale-95 ${
                split === s ? 'bg-violet-400 text-slate-950 border-violet-400' : `${T.card} ${T.border} ${T.text}`
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={onSignOut}
          className={`w-full flex items-center gap-3 rounded-xl border p-3 transition-all active:scale-95 ${T.card} ${T.border}`}
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
        @keyframes fadeIn { 0%{ opacity:0; transform: translateY(6px);} 100%{ opacity:1; transform: translateY(0);} }
        .tab-fade { animation: fadeIn 280ms ease; }
        @keyframes eliteGlow { 0%,100%{ box-shadow: 0 0 6px rgba(244,63,94,0.4);} 50%{ box-shadow: 0 0 14px rgba(244,63,94,0.8);} }
        .elite-glow { animation: eliteGlow 2s ease-in-out infinite; }
      `}</style>

      <div className={`font-body relative w-full max-w-md ${T.bg} ${T.text} min-h-screen sm:min-h-0 sm:my-6 sm:rounded-3xl sm:shadow-2xl overflow-hidden`}>

        <div
          className="absolute top-0 left-0 right-0 h-56 pointer-events-none"
          style={{ background: dark ? 'radial-gradient(60% 100% at 50% 0%, rgba(167,139,250,0.12), transparent)' : 'radial-gradient(60% 100% at 50% 0%, rgba(167,139,250,0.16), transparent)' }}
        />

        {toast && (
          <div
            key={toast + Date.now()}
            className={`toast-anim fixed top-5 left-1/2 z-50 px-4 py-2 rounded-full font-disp font-bold text-sm tracking-wide border ${dark ? 'bg-violet-400 text-slate-950 border-violet-300' : 'bg-violet-500 text-white border-violet-400'}`}
            style={{ boxShadow: '0 6px 24px rgba(167,139,250,0.5)' }}
          >
            {toast}
          </div>
        )}

        <Confetti active={confettiActive} />

        <div key={activeTab} className="relative px-5 pt-5 pb-28 tab-fade">{mainContent}</div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40">
          <div className={`flex items-center justify-around border-t px-2 py-2.5 ${T.card} ${T.border} sm:rounded-b-3xl`}>
            {NAV.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)} className="flex flex-col items-center gap-1 px-2 py-1 transition-all active:scale-90">
                  <Icon size={20} className={active ? 'text-violet-400' : T.faint} strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-xs font-medium ${active ? 'text-violet-400' : T.faint}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
