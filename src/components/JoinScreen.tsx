import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Key, ShieldAlert } from 'lucide-react';
import { io } from 'socket.io-client';

interface JoinScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (name: string, roomId: string, passcode?: string) => void;
  roomId: string;
  errorMessage?: string;
}

export default function JoinScreen({ isOpen, onClose, onJoin, roomId, errorMessage }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [remoteNeeds, setRemoteNeeds] = useState({ exists: false, hasPasscode: false, waitingRoom: false });

  useEffect(() => {
    if (isOpen && roomId) {
      // Create temporary socket to inspect room config
      const socket = io();
      socket.emit('check-room-needs', roomId, (data: any) => {
        setRemoteNeeds(data);
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#161618] border border-[#2A2A2E] w-full max-w-sm rounded-xl overflow-hidden shadow-2xl relative"
      >
        <div className="p-4 border-b border-[#2A2A2E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93]">Join Meeting Room</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#2A2A2E] rounded-md transition-colors text-[#8E8E93]">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-xs">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {remoteNeeds.exists && (
            <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg text-[11px] text-[#A2A4AF] leading-relaxed">
              <span className="font-semibold text-blue-400">Meeting Room Status: </span>
              {remoteNeeds.waitingRoom ? 'Waiting room enabled.' : 'Direct entrance enabled.'} 
              {remoteNeeds.hasPasscode ? ' Password required.' : ' No password required.'}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F]">Meeting ID</label>
            <div className="p-2.5 bg-[#0F0F10] rounded-lg border border-[#2A2A2E] text-white text-xs font-mono font-bold">
              {roomId}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F]">Your Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A4A4F]" />
              <input
                autoFocus
                type="text"
                placeholder="Ex: John Doe"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0F0F10] border border-[#2A2A2E] rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-sm placeholder:text-[#4A4A4F] text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {remoteNeeds.hasPasscode && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F] flex justify-between">
                <span>Passcode / Password</span>
                <span className="text-red-400 text-[9px]">REQUIRED</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A4A4F]" />
                <input
                  type="password"
                  placeholder="Enter 6-digit passcode"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0F0F10] border border-[#2A2A2E] rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-sm placeholder:text-[#4A4A4F] text-white tracking-widest font-mono"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name, roomId, passcode)}
                />
              </div>
            </div>
          )}

          <button
            onClick={() => name.trim() && onJoin(name, roomId, passcode)}
            disabled={!name.trim() || (remoteNeeds.hasPasscode && !passcode.trim())}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-[#2A2A2E] disabled:text-[#4A4A4F] transition-all rounded-lg font-bold text-sm text-white uppercase tracking-wide cursor-pointer shadow-lg shadow-blue-500/10"
          >
            Join Meeting Room
          </button>
        </div>
      </motion.div>
    </div>
  );
}
