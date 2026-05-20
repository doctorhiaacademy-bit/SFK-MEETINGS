import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User } from 'lucide-react';

interface JoinScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (name: string, roomId: string) => void;
  roomId: string;
}

export default function JoinScreen({ isOpen, onClose, onJoin, roomId }: JoinScreenProps) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#161618] border border-[#2A2A2E] w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-[#2A2A2E] flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#8E8E93]">Join Meeting</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#2A2A2E] rounded-md transition-colors text-[#8E8E93]">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A4F]">Meeting ID</label>
            <div className="p-2.5 bg-[#0F0F10] rounded-lg border border-[#2A2A2E] text-[#8E8E93] text-xs font-mono">
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
                className="w-full pl-10 pr-4 py-2.5 bg-[#0F0F10] border border-[#2A2A2E] rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-sm placeholder:text-[#4A4A4F]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name, roomId)}
              />
            </div>
          </div>

          <button
            onClick={() => name.trim() && onJoin(name, roomId)}
            disabled={!name.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-[#2A2A2E] disabled:text-[#4A4A4F] transition-all rounded-lg font-bold text-sm text-white"
          >
            JOIN MEETING
          </button>
        </div>
      </motion.div>
    </div>
  );
}
