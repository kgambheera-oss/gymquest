import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';

const SPLIT_DAYS = {
  'Push/Pull/Legs': [{ label: 'Push Day' }, { label: 'Pull Day' }, { label: 'Leg Day' }],
  'Upper/Lower': [{ label: 'Upper Day' }, { label: 'Lower Day' }],
  'Full Body': [{ label: 'Full Body Day' }],
  Bodybuilding: [{ label: 'Chest & Triceps' }, { label: 'Back & Biceps' }, { label: 'Shoulders' }, { label: 'Legs' }],
  Powerlifting: [{ label: 'Squat Day' }, { label: 'Bench Day' }, { label: 'Deadlift Day' }],
  Custom: [{ label: 'Workout Day' }],
};

function getWorkoutForDay(splitName, dayIndex) {
  const days = SPLIT_DAYS[splitName] || SPLIT_DAYS['Push/Pull/Legs'];
  const idx = ((dayIndex % days.length) + days.length) % days.length;
  return days[idx];
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

async function fetchRoster(guildId) {
  const { data: rosterRows } = await supabase
    .from('guild_members')
    .select('user_id, profiles ( username, level, xp )')
    .eq('guild_id', guildId);
  return (rosterRows || [])
    .map((r) => ({ userId: r.user_id, username: r.profiles?.username, level: r.profiles?.level || 1, xp: r.profiles?.xp || 0 }))
    .sort((a, b) => b.xp - a.xp);
}

async function fetchFriends(myId) {
  const { data: rows } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

  const all = rows || [];
  const accepted = all.filter((r) => r.status === 'accepted');
  const incoming = all.filter((r) => r.status === 'pending' && r.addressee_id === myId);
  const outgoingIds = all.filter((r) => r.status === 'pending' && r.requester_id === myId).map((r) => r.addressee_id);

  const otherIds = [
    ...accepted.map((r) => (r.requester_id === myId ? r.addressee_id : r.requester_id)),
    ...incoming.map((r) => r.requester_id),
  ];

  let profilesById = {};
  if (otherIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, username, xp, level').in('id', [...new Set(otherIds)]);
    profilesById = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  }

  const friends = accepted
    .map((r) => {
      const otherId = r.requester_id === myId ? r.addressee_id : r.requester_id;
      const p = profilesById[otherId];
      return p ? { userId: otherId, username: p.username, xp: p.xp || 0, level: p.level || 1 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.xp - a.xp);

  const requests = incoming
    .map((r) => {
      const p = profilesById[r.requester_id];
      return p ? { friendshipId: r.id, userId: r.requester_id, username: p.username, xp: p.xp || 0, level: p.level || 1 } : null;
    })
    .filter(Boolean);

  return { friends, requests, outgoingIds };
}

async function fetchActivity(myId, friendIds) {
  const ids = [myId, ...friendIds];
  const { data } = await supabase
    .from('activity_log')
    .select('id, user_id, action, created_at, profiles ( username )')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data || []).map((a) => ({
    id: a.id,
    username: a.profiles?.username || '?',
    action: a.action,
    time: timeAgo(a.created_at),
  }));
}

async function fetchAttributeCounts(myId) {
  const { data } = await supabase.from('exercise_logs').select('category, reps, sets').eq('user_id', myId);
  const counts = { strength: 0, power: 0, endurance: 0, stamina: 0 };
  (data || []).forEach((r) => {
    const vol = (r.reps || 0) * (r.sets || 1);
    if (counts[r.category] !== undefined) counts[r.category] += vol;
  });
  return counts;
}

async function fetchDisciplineCount(myId) {
  const { count } = await supabase.from('quests').select('*', { count: 'exact', head: true }).eq('user_id', myId).eq('done', true);
  return count || 0;
}

async function fetchWorkoutCount(myId) {
  const { count } = await supabase.from('quests').select('*', { count: 'exact', head: true }).eq('user_id', myId).eq('kind', 'hero').eq('done', true);
  return count || 0;
}

async function fetchCompletedDates(myId) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const { data } = await supabase
    .from('quests')
    .select('quest_date')
    .eq('user_id', myId)
    .eq('kind', 'hero')
    .eq('done', true)
    .gte('quest_date', cutoffStr);
  return (data || []).map((r) => r.quest_date);
}

async function fetchWeeklyStats(myId) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const { data: weekQuests } = await supabase
    .from('quests')
    .select('done, xp_reward, kind')
    .eq('user_id', myId)
    .gte('quest_date', weekAgoStr);

  const rows = weekQuests || [];
  const workoutsThisWeek = rows.filter((q) => q.kind === 'hero' && q.done).length;
  const xpThisWeek = rows.filter((q) => q.done).reduce((sum, q) => sum + (q.xp_reward || 0), 0);
  const completionRate = rows.length > 0 ? Math.round((rows.filter((q) => q.done).length / rows.length) * 100) : 0;

  const { count: liftsThisWeek } = await supabase
    .from('exercise_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', myId)
    .gte('created_at', weekAgo.toISOString());

  return { workoutsThisWeek, xpThisWeek, completionRate, liftsThisWeek: liftsThisWeek || 0 };
}

async function fetchCheckinPhotos(myId) {
  const { data } = await supabase
    .from('checkins')
    .select('id, photo_url, created_at')
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(30);
  return data || [];
}

const VARIETY_QUEST_POOL = [
  { title: 'Log 8 working sets', xp_reward: 50 },
  { title: 'Log 3 different exercises', xp_reward: 60 },
  { title: 'Stretch for 10 minutes', xp_reward: 25 },
  { title: 'Warm up properly', xp_reward: 20 },
  { title: 'Cool down & stretch', xp_reward: 25 },
  { title: 'Try a new exercise', xp_reward: 40 },
];

function pickVarietyQuest(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) % VARIETY_QUEST_POOL.length;
  return VARIETY_QUEST_POOL[Math.abs(hash)];
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState(null);
  const [guildInfo, setGuildInfo] = useState(null);
  const [availableGuilds, setAvailableGuilds] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [outgoingIds, setOutgoingIds] = useState([]);
  const [activity, setActivity] = useState([]);
  const [attributeCounts, setAttributeCounts] = useState({ strength: 0, power: 0, endurance: 0, stamina: 0 });
  const [disciplineCount, setDisciplineCount] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [completedDates, setCompletedDates] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({ workoutsThisWeek: 0, xpThisWeek: 0, completionRate: 0, liftsThisWeek: 0 });
  const [checkinPhotos, setCheckinPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setQuests(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      setLoading(true);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(profileData);

      const today = new Date().toISOString().slice(0, 10);
      const { data: questData } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('quest_date', today);

      const hasHero = questData && questData.some((q) => q.kind === 'hero');
      const splitDays = SPLIT_DAYS[profileData?.split] || SPLIT_DAYS['Push/Pull/Legs'];
      const todayIndex = ((profileData?.split_day_index || 0) % splitDays.length + splitDays.length) % splitDays.length;
      const workout = getWorkoutForDay(profileData?.split, todayIndex);

      const advanceDayIndex = async () => {
        const nextIndex = (todayIndex + 1) % splitDays.length;
        await supabase.from('profiles').update({ split_day_index: nextIndex }).eq('id', session.user.id);
      };

      if (questData && questData.length > 0 && hasHero) {
        setQuests(questData);
      } else if (questData && questData.length > 0 && !hasHero) {
        const { data: heroInserted } = await supabase
          .from('quests')
          .insert([{ title: workout.label, xp_reward: 150, kind: 'hero', user_id: session.user.id, quest_date: today }])
          .select();
        setQuests([...(heroInserted || []), ...questData]);
        await advanceDayIndex();
      } else {
        const varietyQuest = pickVarietyQuest(today);
        const seeded = [
          { title: workout.label, xp_reward: 150, kind: 'hero' },
          { title: varietyQuest.title, xp_reward: varietyQuest.xp_reward, kind: 'daily' },
          { title: 'Gym photo check-in', xp_reward: 30, kind: 'daily' },
          { title: 'Beat a previous PR', xp_reward: 100, kind: 'daily' },
        ].map((q) => ({ ...q, user_id: session.user.id, quest_date: today }));
        const { data: inserted } = await supabase.from('quests').insert(seeded).select();
        setQuests(inserted || []);
        await advanceDayIndex();
      }

      const { data: membership } = await supabase
        .from('guild_members')
        .select('guild_id, guilds ( id, name )')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membership && membership.guilds) {
        const roster = await fetchRoster(membership.guild_id);
        setGuildInfo({ id: membership.guild_id, name: membership.guilds.name, roster });
      } else {
        const { data: guildsList } = await supabase.from('guilds').select('id, name');
        setAvailableGuilds(guildsList || []);
      }

      const friendData = await fetchFriends(session.user.id);
      setFriends(friendData.friends);
      setFriendRequests(friendData.requests);
      setOutgoingIds(friendData.outgoingIds);

      const friendIds = friendData.friends.map((f) => f.userId);
      const activityData = await fetchActivity(session.user.id, friendIds);
      setActivity(activityData);

      const counts = await fetchAttributeCounts(session.user.id);
      setAttributeCounts(counts);

      const discipline = await fetchDisciplineCount(session.user.id);
      setDisciplineCount(discipline);

      const workouts = await fetchWorkoutCount(session.user.id);
      setWorkoutCount(workouts);

      const dates = await fetchCompletedDates(session.user.id);
      setCompletedDates(dates);

      const weekly = await fetchWeeklyStats(session.user.id);
      setWeeklyStats(weekly);

      const photos = await fetchCheckinPhotos(session.user.id);
      setCheckinPhotos(photos);

      setLoading(false);
    };

    load();
  }, [session]);

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  if (!session) return <Auth />;

  if (loading || !profile || !quests) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Loading your character…
      </div>
    );
  }

  return (
    <Dashboard
      userId={session.user.id}
      initialXp={profile.xp}
      initialLevel={profile.level}
      initialStreak={profile.streak}
      initialLongestStreak={profile.longest_streak}
      initialWorkoutCount={workoutCount}
      createdAt={profile.created_at}
      username={profile.username}
      initialSplit={profile.split}
      initialSplitDayIndex={profile.split_day_index || 0}
      initialQuests={quests}
      initialGuild={guildInfo}
      initialAvailableGuilds={availableGuilds}
      initialFriends={friends}
      initialFriendRequests={friendRequests}
      initialOutgoingIds={outgoingIds}
      initialActivity={activity}
      initialAttributeCounts={attributeCounts}
      initialDisciplineCount={disciplineCount}
      initialCompletedDates={completedDates}
      initialWeeklyStats={weeklyStats}
      initialCheckinPhotos={checkinPhotos}
      onSignOut={handleSignOut}
    />
  );
}
