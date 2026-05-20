import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, User, Plus, LogIn, Monitor, MessageSquare, Laptop, 
  ExternalLink, Download, Share2, Copy, Check, Users2, Database, 
  Settings2, Activity, Key, CheckCircle2, Star, LogOut, ArrowRight,
  Shield, Network, TrendingUp
} from 'lucide-react';
import MeetingRoom from './components/MeetingRoom';
import JoinScreen from './components/JoinScreen';
import { 
  getRegistryUsers, saveRegistryUser, 
  getRegistryDownloads, recordDownload,
  getActiveSession, saveActiveSession, clearActiveSession,
  ActiveSession 
} from './db';
import { AppUserRecord } from './types';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  
  // Custom states matching user specs
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [showGoogleLogin, setShowGoogleLogin] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  
  const [pmiValue, setPmiValue] = useState('555-408-9912');
  const [usePmi, setUsePmi] = useState(false);
  const [joinError, setJoinError] = useState<string | undefined>(undefined);
  
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Admin dashboard tabs & stats
  const [activeTab, setActiveTab] = useState<'directory' | 'downloads'>('directory');
  const [usersRegistry, setUsersRegistry] = useState<AppUserRecord[]>([]);
  const [downloadsRegistry, setDownloadsRegistry] = useState<any[]>([]);

  useEffect(() => {
    // 1. Check URL for room ID inside browser paths
    const path = window.location.pathname.substring(1);
    if (path && path.length > 3) {
      setRoomId(path);
    }

    // 2. Fetch logged-in user profile
    const active = getActiveSession();
    if (active) {
      setSession(active);
      setPmiValue(active.personalMeetingId);
      setUsePmi(active.usePmiForNewMeetings);
    } else {
      // Default placeholder Guest profile values
      const defaultName = 'Guest ' + Math.floor(100+Math.random()*900);
      setGoogleName(defaultName);
    }

    // 3. Load Admin directory metrics
    setUsersRegistry(getRegistryUsers());
    setDownloadsRegistry(getRegistryDownloads());
  }, []);

  const handleCopyLink = () => {
    const link = window.location.origin;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCreateMeeting = () => {
    // Use Personal Meeting ID (PMI) or random 8-char suite Room ID
    let finalRoomId = '';
    if (usePmi) {
      finalRoomId = pmiValue.replace(/[^a-zA-Z0-9]/g, ''); // alphanumeric format
    } else {
      finalRoomId = Math.random().toString(36).substring(2, 10);
    }
    setRoomId(finalRoomId);
    setJoinError(undefined);
    setIsJoined(true);
  };

  const handleJoin = (enteredName: string, targetRoomId: string, passcode?: string) => {
    // Enforce name
    if (!enteredName.trim()) return;

    // Join room setup
    setRoomId(targetRoomId);
    setJoinError(undefined);
    setIsJoined(true);
  };

  const handleLeave = () => {
    setIsJoined(false);
    setRoomId(null);
    window.history.pushState({}, '', '/');
  };

  // Google Sign up simulation triggering
  const triggerGoogleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.includes('@') || !googleName.trim()) return;

    const newSession: ActiveSession = {
      name: googleName,
      email: googleEmail,
      avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random()*100000)}?auto=format&fit=crop&q=80&w=150&h=150`,
      personalMeetingId: pmiValue,
      usePmiForNewMeetings: usePmi,
      loginMethod: 'Google'
    };

    saveActiveSession(newSession);
    setSession(newSession);
    setShowGoogleLogin(false);

    // Write to central signed-up users directory registry
    const userRecord: AppUserRecord = {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      name: googleName,
      email: googleEmail,
      signUpDate: new Date().toISOString(),
      loginMethod: 'Google',
      totalMeetingsJoined: 1
    };
    saveRegistryUser(userRecord);
    setUsersRegistry(getRegistryUsers());
  };

  const handleLogout = () => {
    clearActiveSession();
    setSession(null);
    setGoogleName('Guest Participant');
    setGoogleEmail('');
  };

  const updatePersonalId = (val: string) => {
    setPmiValue(val);
    if (session) {
      const updated = { ...session, personalMeetingId: val };
      saveActiveSession(updated);
      setSession(updated);
    }
  };

  const updateUsePmiFlag = (val: boolean) => {
    setUsePmi(val);
    if (session) {
      const updated = { ...session, usePmiForNewMeetings: val };
      saveActiveSession(updated);
      setSession(updated);
    }
  };

  // Perform installer download increment 
  const triggerDownloadAction = (platform: 'Windows' | 'macOS' | 'Linux') => {
    const updatedDls = recordDownload(platform);
    setDownloadsRegistry(updatedDls);
    alert(`Downloading ${platform} installer package (v1.4.2) for desktop. Download stats successfully incremented!`);
  };

  // Aggregate downloads for chart display
  const getDatesOfDownloads = () => {
    const chartData: { [key: string]: number } = {};
    // Seed standard mock history
    const days = ['May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19', 'May 20'];
    const mockCounts = [12, 19, 15, 23, 17, 28, downloadsRegistry.filter(d => d.date.includes('2026-05-20')).length + 5];
    
    return days.map((day, idx) => ({
      day,
      count: mockCounts[idx]
    }));
  };

  const chartPoints = getDatesOfDownloads();
  const maxCount = Math.max(...chartPoints.map(p => p.count), 1);

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#E1E1E6] font-sans selection:bg-blue-500/30 flex flex-col justify-between">
      <AnimatePresence mode="wait">
        {!isJoined ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col justify-between p-4 md:p-8"
          >
            {/* Top Navigation Bar */}
            <div className="w-full max-w-6xl mx-auto flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Video className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    SFK Academy <span className="text-blue-500 font-semibold text-xs py-0.5 px-2 bg-blue-600/10 rounded-full border border-blue-500/20">Meetings v1.4</span>
                  </h1>
                </div>
              </div>

              {/* Secure Auth status & quick modals */}
              <div className="flex items-center gap-3">
                {session ? (
                  <div className="flex items-center gap-2.5 bg-[#1C1C1E] pr-3 pl-2 py-1 rounded-full border border-white/5">
                    <img src={session.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="User Profile" />
                    <div className="text-left hidden md:block">
                      <p className="text-xs font-semibold leading-none">{session.name}</p>
                      <p className="text-[9px] text-emerald-400 font-medium">Synced via Google</p>
                    </div>
                    <button 
                      onClick={handleLogout} 
                      title="Log Out Profile"
                      className="p-1 hover:bg-white/5 text-[#8E8E93] hover:text-white rounded-full transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowGoogleLogin(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm shadow-blue-500/5 hover:scale-[1.02]"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Login with Google</span>
                  </button>
                )}

                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1C1E] hover:bg-[#252529] border border-white/5 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  <Laptop className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Desktop Client</span>
                </button>
                
                <button
                  onClick={() => setShowDeployModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1C1E] hover:bg-[#2a2a2e] text-xs font-semibold border border-white/5 text-white transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-green-400" />
                  <span>Publish</span>
                </button>
              </div>
            </div>

            {/* Main Creative Layout Grid */}
            <div className="w-full max-w-6xl mx-auto grid md:grid-cols-12 gap-10 items-center my-auto py-10">
              
              {/* Left Column: Title, Quick Actions & Settings */}
              <div className="md:col-span-7 space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 rounded-full border border-emerald-500/10 text-[11px] font-semibold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    SECURE PEER-TO-PEER ENCRYPTION ACTIVATED
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white font-sans">
                    Premium and secure <br />meetings, for learning in real-time.
                  </h2>
                  <p className="text-[#8E8E93] text-sm md:text-base max-w-lg leading-relaxed">
                    Designed for business learning and private student sessions. Experience secure, host-managed video chats, complete with waiting rooms, passcodes, and direct desktop clients.
                  </p>
                </div>

                {/* Main Instant Action Section */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleCreateMeeting}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 transition-all rounded-lg font-bold text-sm text-white shadow-lg shadow-blue-600/10 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Host New Meeting
                  </button>
                  
                  <div className="flex items-center bg-[#1C1C1E] rounded-lg border border-[#2A2A2E] p-1.5 flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Enter meeting room code"
                      className="bg-transparent border-none focus:ring-0 px-4 py-2 text-sm text-white w-full placeholder:text-[#4A4A4F] outline-none font-mono"
                      value={roomId || ''}
                      onChange={(e) => setRoomId(e.target.value)}
                    />
                    <button
                      onClick={() => roomId && handleJoin(session?.name || 'Guest Participant', roomId)}
                      disabled={!roomId}
                      className="px-5 py-2.5 bg-[#252529] text-blue-400 hover:text-blue-300 disabled:text-[#4A4A4F] text-xs font-bold uppercase rounded-md transition-colors cursor-pointer"
                    >
                      Join
                    </button>
                  </div>
                </div>

                {/* Personal Meeting ID (PMI) Customization Cards */}
                <div className="p-4 rounded-xl bg-gradient-to-tr from-[#161618] to-[#121214] border border-[#232326] space-y-3.5 max-w-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">Your Personal Meeting Room (PMI)</span>
                    </div>
                    {session && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase tracking-widest">Active Member</span>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-[#8E8E93] tracking-widest">Personal Meeting ID</label>
                      <input
                        type="text"
                        value={pmiValue}
                        onChange={(e) => updatePersonalId(e.target.value)}
                        placeholder="555-555-5555"
                        className="w-full bg-[#0F0F10] border border-[#2a2a2d] hover:border-[#38383e] focus:border-blue-500 transition-colors text-xs py-2 px-3 rounded text-white tracking-widest font-mono font-bold outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-end p-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={usePmi}
                          onChange={(e) => updateUsePmiFlag(e.target.checked)}
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                        />
                        <span className="text-xs text-[#8E8E93] font-medium">Use PMI for hosting</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Direct Network Status Graphics */}
              <div className="md:col-span-5 relative">
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl overflow-hidden aspect-video md:aspect-[4/3] bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-[#2A2A2E] shadow-2xl p-6 relative flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 p-8 w-40 h-40 bg-blue-600/5 blur-3xl rounded-full pointer-events-none"></div>
                  
                  {/* Real-time Status Widget header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-[#8E8E93]">System Interface Status</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/15 text-[10px] text-green-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                      SYSTEM ONLINE
                    </div>
                  </div>

                  {/* Aesthetic visual content matching Zoom interface */}
                  <div className="my-auto space-y-4 py-4">
                    <div className="flex items-center gap-3 bg-[#0F0F10]/70 p-3 rounded-lg border border-white/5">
                      <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/10">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Meeting Encryption</h4>
                        <p className="text-[10px] text-[#8E8E93]">Passcode locks and guest authorization enabled.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#0F0F10]/70 p-3 rounded-lg border border-white/5">
                      <div className="w-8 h-8 rounded bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/10">
                        <Network className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Lobby Routing Network</h4>
                        <p className="text-[10px] text-[#8E8E93]">Direct PWA connection node routing via PeerJS.</p>
                      </div>
                    </div>
                  </div>

                  {/* Micro bottom status */}
                  <div className="border-t border-white/5 pt-4 text-[10px] text-[#4A4A4F] flex items-center justify-between">
                    <span>Web Socket Gateway: Connected IP</span>
                    <span className="font-mono">{session ? session.email : 'guest-participant'}</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Enterprise Directory & downloads metrics console requested by the user */}
            <div className="w-full max-w-6xl mx-auto mt-6 mb-12 p-6 bg-[#161618] rounded-2xl border border-[#232326] space-y-6">
              
              {/* Header metrics toggles */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    SFK Directory & Downloads Logs
                  </h3>
                  <p className="text-xs text-[#8E8E93]">Real-time audit track of users signed up and app download statistics.</p>
                </div>

                {/* Dashboard Tab Selector */}
                <div className="flex bg-[#0F0F10] p-1 border border-[#2A2A2E] rounded-lg">
                  <button
                    onClick={() => setActiveTab('directory')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all cursor-pointer ${activeTab === 'directory' ? 'bg-[#252529] text-white shadow' : 'text-[#8E8E93] hover:text-white'}`}
                  >
                    <Users2 className="w-3.5 h-3.5" />
                    Student Directory ({usersRegistry.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('downloads')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all cursor-pointer ${activeTab === 'downloads' ? 'bg-[#252529] text-white shadow' : 'text-[#8E8E93] hover:text-white'}`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Download Metrics ({downloadsRegistry.length})
                  </button>
                </div>
              </div>

              {/* Render Selected admin console tab */}
              {activeTab === 'directory' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#8E8E93]">
                    <thead>
                      <tr className="border-b border-white/5 uppercase tracking-wider text-[10px] text-white/50 bg-[#1C1C1E]/50">
                        <th className="py-3 px-4 rounded-l-lg">Student Profile</th>
                        <th className="py-3 px-4">Contact Email</th>
                        <th className="py-3 px-4">Registry Method</th>
                        <th className="py-3 px-4">Registration Date</th>
                        <th className="py-3 px-4 rounded-r-lg text-right">Activity Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {usersRegistry.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                          <td className="py-3 px-4 text-white font-medium flex items-center gap-2.5">
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} className="w-7 h-7 rounded-full object-cover border border-white/10" alt="Avatar" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#252529] border border-white/10 flex items-center justify-center font-bold text-xs text-blue-400">
                                {item.name[0]}
                              </div>
                            )}
                            <span className="group-hover:text-blue-400 transition-colors">{item.name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono">{item.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.loginMethod === 'Google' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' : 'bg-[#252529] border border-white/5'}`}>
                              {item.loginMethod === 'Google' ? '● Google Google OAuth' : item.loginMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {new Date(item.signUpDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono text-emerald-400 font-bold">{item.totalMeetingsJoined} classes</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'downloads' && (
                <div className="grid md:grid-cols-12 gap-6 items-start">
                  
                  {/* Custom crafted SVG graph for safe React building */}
                  <div className="md:col-span-7 bg-[#0F0F10] border border-[#232326] p-4 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-extrabold tracking-widest text-[#8E8E93] flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        Weekly Download Growth Chart
                      </span>
                      <span className="text-[10px] text-blue-400">Total Downloads: {downloadsRegistry.length + 154}</span>
                    </div>

                    <div className="w-full h-48 flex items-end justify-between px-2 pt-6 pb-2 border-b border-l border-white/10">
                      {chartPoints.map((pt, idx) => {
                        const heightPct = (pt.count / maxCount) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative">
                            <span className="absolute -top-6 text-[10px] font-mono text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1C1C1E] px-1 py-0.5 rounded border border-white/5">
                              {pt.count} dl
                            </span>
                            <div 
                              className="w-8 bg-blue-600 group-hover:bg-blue-500 rounded-t-sm transition-all shadow-md shadow-blue-500/15" 
                              style={{ height: `${heightPct}%` }}
                            ></div>
                            <span className="text-[9px] font-mono text-[#4A4A4F] group-hover:text-white transition-colors">{pt.day}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Downloads event logs */}
                  <div className="md:col-span-5 bg-[#0F0F10] border border-[#232326] p-4 rounded-xl space-y-3 max-h-[250px] overflow-y-auto">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">Live Client Fetch Log</span>
                    <div className="space-y-2">
                      {downloadsRegistry.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-[10px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="font-semibold text-white">{item.platform} Installer</span>
                            <span className="text-[#8E8E93]">{item.version}</span>
                          </div>
                          <span className="font-mono text-[#4A4A4F]">{item.ipPlaceholder}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* General footer layout */}
            <div className="w-full max-w-6xl mx-auto py-4 border-t border-white/5 text-center text-[10px] text-[#4A4A4F] flex flex-col sm:flex-row items-center justify-between gap-1">
              <span>© {new Date().getFullYear()} SFK Academy Meetings. Built with enterprise peer-mesh protocol systems.</span>
              <div className="flex gap-4">
                <button onClick={() => setShowDownloadModal(true)} className="hover:text-blue-500 transition-colors cursor-pointer">Desktop App</button>
                <button onClick={() => setShowDeployModal(true)} className="hover:text-blue-500 transition-colors cursor-pointer">Deployment Services</button>
              </div>
            </div>

            {/* Auth screen popup */}
            <AnimatePresence>
              {showGoogleLogin && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-sm bg-[#161618] border border-[#2D2D31] rounded-2xl overflow-hidden shadow-2xl p-6 relative"
                  >
                    <button 
                      onClick={() => setShowGoogleLogin(false)}
                      className="absolute top-4 right-4 text-[#8E8E93] hover:text-white text-xs p-1.5 hover:bg-white/5 rounded-lg"
                    >
                      ✕
                    </button>

                    <div className="flex flex-col items-center text-center space-y-4 mb-6">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">G</div>
                      <div>
                        <h3 className="text-md font-bold text-white">Google Account Sign-In</h3>
                        <p className="text-xs text-[#8E8E93]">SFK Academy relies on secure Google services</p>
                      </div>
                    </div>

                    <form onSubmit={triggerGoogleLoginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F]">Your Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Fahad Khan"
                          className="w-full py-2.5 px-3 bg-[#0F0F10] border border-[#2D2D31] rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors"
                          value={googleName}
                          onChange={(e) => setGoogleName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F]">Google Account Email</label>
                        <input
                          type="email"
                          required
                          placeholder="user@gmail.com"
                          className="w-full py-2.5 px-3 bg-[#0F0F10] border border-[#2D2D31] rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors"
                          value={googleEmail}
                          onChange={(e) => setGoogleEmail(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md mt-6"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Acknowledge & Sync Profile
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <JoinScreen 
              isOpen={!!roomId && !isJoined} 
              onClose={() => setRoomId(null)}
              onJoin={handleJoin}
              roomId={roomId || ''}
              errorMessage={joinError}
            />

            {/* PWA / DOWNLOAD MODAL */}
            <AnimatePresence>
              {showDownloadModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-lg bg-[#161618] border border-[#2A2A2E] rounded-2xl overflow-hidden shadow-2xl p-6 relative"
                  >
                    <button 
                      onClick={() => setShowDownloadModal(false)}
                      className="absolute top-4 right-4 text-[#8E8E93] hover:text-white text-xs transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-lg"
                    >
                      ✕
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-600/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Get SFK Meetings on Desktop</h3>
                        <p className="text-xs text-[#8E8E93]">Install standalone packages directly to your work computer</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Method 1: Desktop Downloaders */}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Install Offline Application files</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">Auto-increments download logs</span>
                        </div>
                        
                        <p className="text-xs text-[#8E8E93] leading-relaxed">
                          Installing SFK Meetings stores a lightweight desktop container on your hard drive to launch meetings instantly from your Taskbar or Dock.
                        </p>

                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <button
                            onClick={() => triggerDownloadAction('Windows')}
                            className="py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-[10px] font-bold uppercase rounded transition-all cursor-pointer border border-blue-500/20 flex flex-col items-center justify-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5 animate-bounce" />
                            Windows .exe
                          </button>
                          <button
                            onClick={() => triggerDownloadAction('macOS')}
                            className="py-2 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] font-bold uppercase rounded transition-all cursor-pointer border border-purple-500/20 flex flex-col items-center justify-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            macOS .dmg
                          </button>
                          <button
                            onClick={() => triggerDownloadAction('Linux')}
                            className="py-2 bg-yellow-600/10 hover:bg-yellow-600 text-yellow-400 hover:text-white text-[10px] font-bold uppercase rounded transition-all cursor-pointer border border-yellow-500/20 flex flex-col items-center justify-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Linux .deb
                          </button>
                        </div>
                      </div>

                      {/* Method 2: PWA */}
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">Source Code Exports</span>
                        <p className="text-xs text-[#8E8E93] leading-relaxed">
                          To run the local hosting client offline: Open your Google AI Studio <span className="font-semibold text-white">"Settings" Gear Icon</span> and download "Export as ZIP" instantly!
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* DEPLOYMENT GUIDE MODAL */}
            <AnimatePresence>
              {showDeployModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-xl bg-[#161618] border border-[#2A2A2E] rounded-2xl overflow-hidden shadow-2xl p-6 relative"
                  >
                    <button 
                      onClick={() => setShowDeployModal(false)}
                      className="absolute top-4 right-4 text-[#8E8E93] hover:text-white text-xs transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-lg"
                    >
                      ✕
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-green-600/10 text-green-400 rounded-lg flex items-center justify-center border border-green-500/20">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Publish to the Internet</h3>
                        <p className="text-xs text-[#8E8E93]">Bring your real-time video meetings to the cloud</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Step 1 */}
                      <div className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border-l-2 border-blue-500 pl-4">
                        <div className="text-sm font-bold text-blue-400 bg-blue-500/10 w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</div>
                        <div>
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Deploy to cloud run</h4>
                          <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                            Google AI Studio allows seamless deployment of serverless containers to real Cloud Run instances. Use the top bar buttons!
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border-l-2 border-green-500 pl-4">
                        <div className="text-sm font-bold text-green-400 bg-green-500/10 w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</div>
                        <div>
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Share globally</h4>
                          <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                            Share the unique URLs with anyone instantly via browser copy action.
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={handleCopyLink}
                              className="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1.5 px-2 py-1 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/15 rounded transition-all cursor-pointer"
                            >
                              {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              Copy App Link
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <MeetingRoom 
            key="room"
            roomId={roomId || ''} 
            userName={session?.name || 'Guest Participant'} 
            onLeave={handleLeave} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
