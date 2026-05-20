/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, User, Plus, LogIn, Monitor, MessageSquare, Mic, MicOff, VideoOff, PhoneOff, Circle, Square, Copy, Check } from 'lucide-react';
import MeetingRoom from './components/MeetingRoom';
import JoinScreen from './components/JoinScreen';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    // Check URL for room ID
    const path = window.location.pathname.substring(1);
    if (path) {
      setRoomId(path);
    }
  }, []);

  const handleCreateMeeting = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    window.history.pushState({}, '', `/${newRoomId}`);
  };

  const handleJoin = (name: string, id: string) => {
    setUserName(name);
    setRoomId(id);
    setIsJoined(true);
    window.history.pushState({}, '', `/${id}`);
  };

  const handleLeave = () => {
    setIsJoined(false);
    setRoomId(null);
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#E1E1E6] font-sans selection:bg-blue-500/30">
      <AnimatePresence mode="wait">
        {!isJoined ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-screen p-4"
          >
            <div className="w-full max-w-4xl grid md:grid-rows-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">SFK Academy <span className="text-blue-500 font-medium">Meetings</span></h1>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold leading-tight tracking-tight">
                    Premium video meetings. Now free for everyone.
                  </h2>
                  <p className="text-[#8E8E93] text-base max-w-md">
                    We've re-engineered the service we built for secure business meetings, SFK Academy Meetings, to make it free and available for all.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleCreateMeeting}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg font-semibold text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Meeting
                  </button>
                  
                  <div className="flex items-center gap-2 p-1 bg-[#1C1C1E] rounded-lg border border-[#2A2A2E]">
                    <input
                      type="text"
                      placeholder="Enter a code or link"
                      className="bg-transparent border-none focus:ring-0 px-4 py-2 text-sm text-[#E1E1E6] w-full sm:w-48 placeholder:text-[#4A4A4F]"
                      value={roomId || ''}
                      onChange={(e) => setRoomId(e.target.value)}
                    />
                    <button
                      onClick={() => roomId && handleJoin(userName || 'Anonymous', roomId)}
                      disabled={!roomId}
                      className="px-4 py-2 text-blue-500 text-sm font-semibold disabled:text-[#4A4A4F] transition-colors"
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative hidden md:block">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl overflow-hidden aspect-video bg-[#1C1C1E] border border-[#2A2A2E] shadow-2xl relative"
                >
                  <img 
                    src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&q=80&w=1074" 
                    alt="Meeting Preview" 
                    className="w-full h-full object-cover opacity-30"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#8E8E93]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[#E1E1E6] text-sm font-medium">Ready to join?</p>
                      <p className="text-[#8E8E93] text-xs">No one else is here</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
            
            <JoinScreen 
              isOpen={!!roomId && !isJoined} 
              onClose={() => setRoomId(null)}
              onJoin={handleJoin}
              roomId={roomId || ''}
            />
          </motion.div>
        ) : (
          <MeetingRoom 
            key="room"
            roomId={roomId || ''} 
            userName={userName} 
            onLeave={handleLeave} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
