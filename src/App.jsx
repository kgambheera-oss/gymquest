import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';

const DEFAULT_QUESTS = [
  { title: 'Push Day Workout', xp_reward: 150, kind: 'hero' },
  { title: 'Log 8 working sets', xp_reward: 50, kind: 'daily' },
  { title: 'Gym photo check-in', xp_reward: 30, kind: 'daily' },
  { title: 'Beat a previous PR', xp_reward: 100, kind: 'daily' },
];

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
        const seeded = DEFAULT_QUESTS.map((q) => ({ ...q, user_id: session.user.id, quest_date: today }));
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
      initialQuests={quests}
      initialBoss={boss}
      initialGuild={guildInfo}
      initialAvailableGuilds={availableGuilds}
      initialFriends={friends}
      initialFriendRequests={friendRequests}
      initialOutgoingIds={outgoingIds}
      onSignOut={handleSignOut}
    />
  );
}
