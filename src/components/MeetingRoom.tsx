import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { 
  Video, Mic, MicOff, VideoOff, PhoneOff, Monitor, 
  MessageSquare, Users, Settings, MoreVertical, 
  Circle, Square, Copy, Check, Send, X
} from 'lucide-react';
import { User, Message } from '../types';

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  onLeave: () => void;
  key?: string;
}

export default function MeetingRoom({ roomId, userName, onLeave }: MeetingRoomProps) {
  const [peers, setPeers] = useState<{ [key: string]: User }>({});
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState('00:00:00');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; userName: string }[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<{ [key: string]: AnalyserNode }>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    // 1. Setup local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setMyStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        // 2. Initialize PeerJS
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log('My peer ID:', id);
          
          // 3. Initialize Socket.io
          const socket = io();
          socketRef.current = socket;

          socket.emit('join-room', roomId, id, userName);

          socket.on('room-info', (info: { hostId: string }) => {
            if (info.hostId === socket.id) setIsHost(true);
          });

          socket.on('user-connected', (userId, remoteName) => {
            console.log('User connected:', userId, remoteName);
            // Call new user
            const call = peer.call(userId, stream, { metadata: { name: userName } });
            call.on('stream', (remoteStream) => {
              setPeers(prev => ({
                ...prev,
                [userId]: { id: userId, stream: remoteStream, name: remoteName, isMuted: false, isVideoOff: false }
              }));
              setupAudioAnalysis(userId, remoteStream);
            });
          });

          socket.on('user-disconnected', (userId) => {
            setPeers(prev => {
              const newPeers = { ...prev };
              delete newPeers[userId];
              return newPeers;
            });
            delete analysersRef.current[userId];
          });

          socket.on('receive-message', (msg: Message) => {
            setMessages(prev => [...prev, msg]);
          });

          socket.on('status-updated', (userId, status) => {
            setPeers(prev => ({
              ...prev,
              [userId]: { ...prev[userId], ...status }
            }));
          });

          socket.on('receive-reaction', (data) => {
            const id = Math.random().toString(36).substr(2, 9);
            setReactions(prev => [...prev, { id, ...data }]);
            setTimeout(() => {
              setReactions(prev => prev.filter(r => r.id !== id));
            }, 3000);
          });

          socket.on('receive-host-action', ({ action, targetId }) => {
            if (action === 'mute-all' && socket.id !== targetId) {
              setIsMuted(true);
              if (myStream) myStream.getAudioTracks().forEach(t => t.enabled = false);
            }
          });
        });

        // Answer incoming calls
        peer.on('call', (call) => {
          call.answer(stream);
          const remoteName = call.metadata?.name || 'Participant';
          call.on('stream', (remoteStream) => {
            setPeers(prev => ({
              ...prev,
              [call.peer]: { id: call.peer, stream: remoteStream, name: remoteName, isMuted: false, isVideoOff: false }
            }));
            setupAudioAnalysis(call.peer, remoteStream);
          });
        });

        setupAudioAnalysis('me', stream);
      });

    return () => {
      socketRef.current?.disconnect();
      peerRef.current?.destroy();
      myStream?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
    };
  }, []);

  const setupAudioAnalysis = (userId: string, stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analysersRef.current[userId] = analyser;
  };

  useEffect(() => {
    const checkAudio = () => {
      Object.entries(analysersRef.current).forEach(([userId, analyser]) => {
        const dataArray = new Uint8Array((analyser as AnalyserNode).frequencyBinCount);
        (analyser as AnalyserNode).getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        if (avg > 30) {
          setActiveSpeaker(userId);
          // Auto-clear after 2 seconds
          setTimeout(() => setActiveSpeaker(prev => prev === userId ? null : prev), 2000);
        }
      });
    };
    const interval = setInterval(checkAudio, 500);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    if (myStream) {
      const newState = !isMuted;
      myStream.getAudioTracks().forEach(track => track.enabled = !newState);
      setIsMuted(newState);
      socketRef.current?.emit('update-status', { isMuted: newState });
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      const newState = !isVideoOff;
      myStream.getVideoTracks().forEach(track => track.enabled = !newState);
      setIsVideoOff(newState);
      socketRef.current?.emit('update-status', { isVideoOff: newState });
    }
  };

  const toggleHandRaise = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit('update-status', { isHandRaised: newState });
  };

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit('send-reaction', emoji);
  };

  const muteAll = () => {
    socketRef.current?.emit('host-action', 'mute-all');
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;
        screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
      } catch (err) {
        console.error("Screen share error:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    if (myVideoRef.current) myVideoRef.current.srcObject = myStream;
  };
    // ... startRecording/stopRecording/sendMessage/copyRoomId ...
  const startRecording = () => {
    const streamToRecord = (myVideoRef.current?.srcObject as MediaStream) || myStream;
    if (!streamToRecord) return;
    
    recordedChunksRef.current = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    const recorder = new MediaRecorder(streamToRecord, options);
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `meeting-recording-${new Date().toISOString()}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && socketRef.current) {
      socketRef.current.emit('send-message', newMessage);
      setNewMessage('');
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(window.location.origin + '/' + roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F0F10] text-[#E1E1E6] overflow-hidden">
      {/* Floating Reactions */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-50 flex flex-col gap-2">
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -200, scale: 1.5 }}
            transition={{ duration: 3 }}
            className="text-4xl flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10"
          >
            {r.emoji} <span className="text-xs font-bold">{r.userName}</span>
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="h-12 border-b border-[#2A2A2E] bg-[#161618] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm text-white">SFK</div>
          <span className="font-semibold text-sm tracking-tight">SFK Academy Meetings — {roomId}</span>
          <div className="flex items-center gap-2 ml-2 px-2 py-0.5 bg-[#252529] rounded border border-[#3A3A3C]">
            <span className="text-[10px] font-mono text-[#8E8E93]">{roomId}</span>
            <button onClick={copyRoomId} className="hover:text-blue-400 transition-colors">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-[#4A4A4F]" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          {isRecording && (
            <div className="flex items-center gap-2 bg-[#2A1414] text-[#FF5C5C] px-2 py-1 rounded border border-[#421C1C]">
              <div className="w-2 h-2 rounded-full bg-[#FF5C5C] animate-pulse"></div>
              REC {elapsed}
            </div>
          )}
          {!isRecording && (
            <div className="bg-[#1C1C1E] px-2 py-1 rounded border border-[#2A2A2E] text-[#8E8E93]">Unlimited Session</div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        <section className={`flex-1 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#0F0F10] transition-all duration-300 ${(showChat || showParticipants) ? 'mr-[280px]' : ''}`}>
          {/* My Video */}
          <div className={`relative bg-[#1C1C1E] rounded-xl border-2 transition-all overflow-hidden shadow-lg ${activeSpeaker === 'me' ? 'border-blue-500 scale-[1.02]' : 'border-[#2A2A2E]'}`}>
            <video 
              ref={myVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-[#252529] flex items-center justify-center text-3xl font-light italic opacity-20">
                {userName}
              </div>
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              {isHandRaised && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500 p-1.5 rounded-full shadow-lg">
                  <span className="text-sm">✋</span>
                </motion.div>
              )}
            </div>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium flex items-center gap-2">
              {activeSpeaker === 'me' && (
                <div className="flex gap-0.5 items-end h-3">
                  <div className="w-1 bg-blue-400 h-1"></div>
                  <div className="w-1 bg-blue-400 h-2"></div>
                  <div className="w-1 bg-blue-400 h-3"></div>
                </div>
              )}
              {userName} (You)
              {isMuted && <MicOff className="w-3 h-3 text-red-500 ml-1" />}
            </div>
          </div>

          {/* Peer Videos */}
          {Object.entries(peers).map(([id, peer]: [string, User]) => (
            <VideoTile 
              key={id} 
              stream={peer.stream!} 
              name={peer.name} 
              isMuted={peer.isMuted} 
              isVideoOff={peer.isVideoOff} 
              isHandRaised={peer.isHandRaised}
              isActive={activeSpeaker === id}
            />
          ))}
        </section>

        {/* Sidebars Container */}
        <AnimatePresence>
          {showParticipants && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-[#161618] border-l border-[#2A2A2E] flex flex-col z-20"
            >
              <div className="p-4 border-b border-[#2A2A2E] flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E8E93]">Participants ({Object.keys(peers).length + 1})</h2>
                <button onClick={() => setShowParticipants(false)} className="p-1 hover:bg-[#2A2A2E] rounded transition-colors">
                  <X className="w-4 h-4 text-[#4A4A4F]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                      {userName[0]}
                    </div>
                    <span className="text-sm font-medium">{userName} (Me)</span>
                  </div>
                  <div className="flex gap-2">
                    {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-[#8E8E93]" />}
                    {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-500" /> : <Video className="w-3.5 h-3.5 text-[#8E8E93]" />}
                  </div>
                </div>
                {Object.values(peers).map((peer: User) => (
                  <div key={peer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xs ring-2 ring-transparent group-hover:ring-blue-500 transition-all">
                        {peer.name[0]}
                      </div>
                      <span className="text-sm">{peer.name}</span>
                      {peer.isHandRaised && <span className="text-xs">✋</span>}
                    </div>
                    <div className="flex gap-2">
                      {peer.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-[#8E8E93]" />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-[#2A2A2E]">
                <button 
                  onClick={muteAll}
                  className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded border border-red-500/20 text-xs font-bold uppercase transition-colors"
                >
                  Mute All
                </button>
              </div>
            </motion.aside>
          )}

          {showChat && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-[#161618] border-l border-[#2A2A2E] flex flex-col z-20"
            >
              <div className="p-4 border-b border-[#2A2A2E] flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E8E93]">In-Meeting Chat</h2>
                <button onClick={() => setShowChat(false)} className="p-1 hover:bg-[#2A2A2E] rounded transition-colors">
                  <X className="w-4 h-4 text-[#4A4A4F]" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-blue-400">{msg.userName}</span>
                      <span className="text-[9px] text-[#4A4A4F]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[#AEAEB2] leading-relaxed bg-[#1C1C1E]/50 p-2 rounded border border-[#2A2A2E]/30">
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-[#2A2A2E]">
                <form onSubmit={sendMessage} className="bg-[#252529] rounded-lg p-2 flex flex-col gap-2 border border-[#3A3A3C]">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(e))}
                    placeholder="Send a message..." 
                    className="bg-transparent text-xs text-[#E1E1E6] outline-none resize-none h-12 w-full placeholder:text-[#4A4A4F]"
                  ></textarea>
                  <div className="flex justify-end">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-[10px] px-3 py-1 rounded font-bold text-white transition-colors">SEND</button>
                  </div>
                </form>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Controls */}
      <footer className="h-20 bg-[#161618] border-t border-[#2A2A2E] flex items-center justify-between px-8 flex-shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div onClick={toggleMute} className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[#252529] border-[#3A3A3C] group-hover:bg-[#3A3A3C] text-[#E1E1E6]'}`}>
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </div>
            <span className={`text-[10px] ${isMuted ? 'text-red-500' : 'text-[#8E8E93]'}`}>{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          <div onClick={toggleVideo} className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[#252529] border-[#3A3A3C] group-hover:bg-[#3A3A3C] text-[#E1E1E6]'}`}>
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </div>
            <span className={`text-[10px] ${isVideoOff ? 'text-red-500' : 'text-[#8E8E93]'}`}>{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowSecurity(false); }} 
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showParticipants ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
              <Users className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${showParticipants ? 'text-blue-400' : 'text-[#8E8E93]'}`}>Participants</span>
          </button>

          <button 
            onClick={() => { setShowChat(!showChat); setShowParticipants(false); setShowSecurity(false); }} 
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showChat ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${showChat ? 'text-blue-400' : 'text-[#8E8E93]'}`}>Chat</span>
          </button>

          {/* Security Menu (Host only) */}
          <div className="relative">
            <button 
              onClick={() => { setShowSecurity(!showSecurity); setShowChat(false); setShowParticipants(false); }} 
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showSecurity ? 'bg-zinc-700 bg-white/10 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
                <Settings className="w-4 h-4" />
              </div>
              <span className={`text-[10px] ${showSecurity ? 'text-white' : 'text-[#8E8E93]'}`}>Security</span>
            </button>
            <AnimatePresence>
              {showSecurity && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl shadow-2xl overflow-hidden p-1 z-50"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider border-b border-[#2A2A2E] mb-1">Host Controls</div>
                  <button onClick={muteAll} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors">
                    <MicOff className="w-3.5 h-3.5" /> Mute All
                  </button>
                  <button onClick={() => socketRef.current?.emit('host-action', 'stop-video-all')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors">
                    <VideoOff className="w-3.5 h-3.5" /> Stop All Video
                  </button>
                  <button onClick={copyRoomId} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors border-t border-[#2A2A2E] mt-1 pt-2">
                    <Copy className="w-3.5 h-3.5" /> Copy Invite Link
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 group">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-900/30 border-green-600/50 text-green-400' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93] group-hover:bg-[#3A3A3C]'}`}>
              <Monitor className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${isScreenSharing ? 'text-green-400 font-medium' : 'text-[#8E8E93]'}`}>Share Screen</span>
          </button>

          {/* Reactions and Hand Raise */}
          <div className="flex items-center h-10 bg-[#252529] border border-[#3A3A3C] rounded-full px-2 gap-1 mx-2">
            <button onClick={toggleHandRaise} className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-colors ${isHandRaised ? 'bg-yellow-500 text-black' : ''}`}>✋</button>
            <button onClick={() => sendReaction('❤️')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-colors">❤️</button>
            <button onClick={() => sendReaction('👏')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-colors">👏</button>
            <button onClick={() => sendReaction('😂')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-colors">😂</button>
          </div>

          <button onClick={isRecording ? stopRecording : startRecording} className="flex flex-col items-center gap-1 group">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isRecording ? 'bg-[#2A1414] border-[#421C1C] text-[#FF5C5C]' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93] group-hover:bg-[#3A3A3C]'}`}>
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-[#FF5C5C] animate-pulse' : 'bg-[#8E8E93]'}`}></div>
            </div>
            <span className={`text-[10px] ${isRecording ? 'text-[#FF5C5C]' : 'text-[#8E8E93]'}`}>{isRecording ? 'Stop Rec' : 'Recording'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 group relative">
          <button 
            onClick={onLeave} 
            className="bg-[#2A1414] hover:bg-red-600/20 text-[#FF5C5C] px-6 py-2.5 rounded-lg font-bold text-sm tracking-tight transition-all border border-[#421C1C] hover:border-red-500/30 flex items-center gap-2"
          >
            Leave
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function VideoTile({ stream, name, isMuted, isVideoOff, isHandRaised, isActive }: { stream: MediaStream; name: string; isMuted?: boolean; isVideoOff?: boolean; isHandRaised?: boolean; isActive?: boolean; key?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative bg-[#1C1C1E] rounded-xl border-2 transition-all duration-300 overflow-hidden shadow-md aspect-video group ${isActive ? 'border-blue-500 scale-[1.02]' : 'border-[#2A2A2E]'}`}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
      />
      {isVideoOff && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D2D32] to-[#161618] flex items-center justify-center">
          <div className="text-3xl font-light text-[#4A4A4F] font-sans">
            {name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute top-3 right-3 flex gap-2">
        {isHandRaised && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500 p-1.5 rounded-full shadow-lg">
            <span className="text-sm">✋</span>
          </motion.div>
        )}
      </div>
      <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium border border-white/5 flex items-center gap-2">
        {isActive && (
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-1 bg-blue-400 h-1"></div>
            <div className="w-1 bg-blue-400 h-2"></div>
            <div className="w-1 bg-blue-400 h-3"></div>
          </div>
        )}
        {name}
        {isMuted && <MicOff className="w-3 h-3 text-red-500 ml-1" />}
      </div>
    </div>
  );
}

