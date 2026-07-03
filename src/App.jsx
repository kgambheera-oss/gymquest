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

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState(null);
  const [boss, setBoss] = useState(null);
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
      onSignOut={handleSignOut}
    />
  );
}
