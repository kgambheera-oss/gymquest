import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';

const SPLIT_DAYS = {
  'Push/Pull/Legs': [
    { label: 'Push Day' },
    { label: 'Pull Day' },
    { label: 'Leg Day' },
  ],
  'Upper/Lower': [{ label: 'Upper Day' }, { label: 'Lower Day' }],
  'Full Body': [{ label: 'Full Body Day' }],
  Bodybuilding: [{ label: 'Chest & Triceps' }, { label: 'Back & Biceps' }, { label: 'Shoulders' }, { label: 'Legs' }],
  Powerlifting: [{ label: 'Squat Day' }, { label: 'Bench Day' }, { label: 'Deadlift Day' }],
  Custom: [{ label: 'Workout Day' }],
};

function getTodaysWorkout(splitName) {
  const days = SPLIT_DAYS[splitName] || SPLIT_DAYS['Push/Pull/Legs'];
  const dayIndex = new Date().getDay() % days.length;
  return days[dayIndex];
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
    .map((r) => ({ userId: r.user_id, username: r.profiles?.username, level: r.profiles?.level, xp: r.profiles?.xp || 0 }))
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

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState(null);
  const [boss, setBoss] = useState(null);
  const [guildInfo, setGuildInfo] = useState(null);
  const [availableGuilds, setAvailableGuilds] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [outgoingIds, setOutgoingIds] = useState([]);
  const [activity, setActivity] = useState([]);
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
        setBoss(null);
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

      if (questData && questData.length > 0) {
        setQuests(questData);
      } else {
        const todaysWorkout = getTodaysWorkout(profileData?.split);
        const seeded = [
          { title: todaysWorkout.label, xp_reward: 150, kind: 'hero' },
          { title: 'Log 8 working sets', xp_reward: 50, kind: 'daily' },
          { title: 'Gym photo check-in', xp_reward: 30, kind: 'daily' },
          { title: 'Beat a previous PR', xp_reward: 100, kind: 'daily' },
        ].map((q) => ({ ...q, user_id: session.user.id, quest_date: today }));
        const { data: inserted } = await supabase.from('quests').insert(seeded).select();
        setQuests(inserted || []);
      }

      const { data: bossData } = await supabase.from('boss_battles').select('*').limit(1).single();
      setBoss(bossData || null);

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
      username={profile.username}
      initialSplit={profile.split}
      initialQuests={quests}
      initialBoss={boss}
      initialGuild={guildInfo}
      initialAvailableGuilds={availableGuilds}
      initialFriends={friends}
      initialFriendRequests={friendRequests}
      initialOutgoingIds={outgoingIds}
      initialActivity={activity}
      onSignOut={handleSignOut}
    />
  );
}
