import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { 
  Video, Mic, MicOff, VideoOff, PhoneOff, Monitor, 
  MessageSquare, Users, Settings, MoreVertical, 
  Circle, Square, Copy, Check, Send, X, Shield, 
  ChevronUp, Lock, Unlock, UserCheck, Trash2, Award, Clock
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
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState('00:00:00');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; userName: string }[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  
  // Advanced features state
  const [isHost, setIsHost] = useState(false);
  const [hostName, setHostName] = useState('Academy Coordinator');
  const [passcode, setPasscode] = useState('SFK-4008');
  const [waitingRoomActive, setWaitingRoomActive] = useState(false);
  const [showInfoDropdown, setShowInfoDropdown] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false); // Guest waiting indicator
  const [waitingList, setWaitingList] = useState<{ socketId: string; userId: string; name: string }[]>([]);

  // Input device states
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<{ [key: string]: AnalyserNode }>({});

  useEffect(() => {
    // 1. Session clock timer
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
    // Enumerate hardware devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const aud = devices.filter(d => d.kind === 'audioinput');
      const vid = devices.filter(d => d.kind === 'videoinput');
      setAudioDevices(aud);
      setVideoDevices(vid);
      if (aud.length > 0) setSelectedAudioId(aud[0].deviceId);
      if (vid.length > 0) setSelectedVideoId(vid[0].deviceId);
    });

    // Connect socket and peerjs setup
    const socket = io();
    socketRef.current = socket;

    // Direct event listener triggers
    socket.emit('join-room', roomId, 'peer-' + Math.random().toString(36).substring(2, 9), userName);

    socket.on('entered-waiting-room', (info: { roomId: string; passcode: string }) => {
      setIsWaiting(true);
      setPasscode(info.passcode);
    });

    socket.on('admitted-by-host', () => {
      setIsWaiting(false);
      initializePeerAndMedia();
    });

    socket.on('rejected-by-host', () => {
      alert("The class host has declined your request to join this meeting room.");
      onLeave();
    });

    // In-room metadata sync
    socket.on('room-info', (info: { hostId: string; isHost: boolean; passcode: string; waitingRoomEnabled: boolean }) => {
      if (info.hostId === socket.id || info.isHost) {
        setIsHost(true);
        setHostName(userName);
      }
      setPasscode(info.passcode);
      setWaitingRoomActive(info.waitingRoomEnabled);
    });

    socket.on('waiting-list-updated', (list: any[]) => {
      setWaitingList(list);
    });

    // Original room events triggers mapped to safe execution
    socket.on('room-info-fallback', (info: { hostId: string }) => {
      if (info.hostId === socket.id) setIsHost(true);
    });

    // If direct entrance is valid, start media immediately
    socket.on('connect', () => {
      // In cases where direct connection is active (no waiting room)
      setTimeout(() => {
        if (!isWaiting) {
          initializePeerAndMedia();
        }
      }, 500);
    });

    return () => {
      socket.disconnect();
      peerRef.current?.destroy();
      myStream?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
    };
  }, []);

  const initializePeerAndMedia = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMyStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log("Acquired PeerID:", id);
        
        socketRef.current?.on('user-connected', (userId, remoteName) => {
          console.log('Class participant connected:', userId, remoteName);
          const call = peer.call(userId, stream, { metadata: { name: userName } });
          call.on('stream', (remoteStream) => {
            setPeers(prev => ({
              ...prev,
              [userId]: { id: userId, stream: remoteStream, name: remoteName, isMuted: false, isVideoOff: false }
            }));
            setupAudioAnalysis(userId, remoteStream);
          });
        });

        // Answer incoming signals
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

        // Other core sockets triggers
        socketRef.current?.on('user-disconnected', (userId) => {
          setPeers(prev => {
            const nextPeers = { ...prev };
            delete nextPeers[userId];
            return nextPeers;
          });
          delete analysersRef.current[userId];
        });

        socketRef.current?.on('receive-message', (msg: Message) => {
          setMessages(prev => [...prev, msg]);
        });

        socketRef.current?.on('status-updated', (userId, status) => {
          setPeers(prev => {
            if (!prev[userId]) return prev;
            return {
              ...prev,
              [userId]: { ...prev[userId], ...status }
            };
          });
        });

        socketRef.current?.on('receive-reaction', (data) => {
          const id = Math.random().toString(36).substring(2, 9);
          setReactions(prev => [...prev, { id, ...data }]);
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
          }, 3000);
        });

        socketRef.current?.on('receive-host-action', ({ action, targetId }) => {
          if (action === 'mute-all' && socketRef.current?.id !== targetId) {
            setIsMuted(true);
            stream.getAudioTracks().forEach(t => t.enabled = false);
          } else if (action === 'stop-video-all' && socketRef.current?.id !== targetId) {
            setIsVideoOff(true);
            stream.getVideoTracks().forEach(t => t.enabled = false);
          }
        });
      });

      setupAudioAnalysis('me', stream);

    } catch (err) {
      console.warn("Media stream init fallback:", err);
      // Fallback to purely audio or direct empty track
      alert("Microphone/Camera permission needed. Please ensure your microphone sources are accessible.");
    }
  };

  const setupAudioAnalysis = (userId: string, stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysersRef.current[userId] = analyser;
    } catch(e) {
      console.log("Audio analysis setup error:", e);
    }
  };

  useEffect(() => {
    const checkAudio = () => {
      Object.entries(analysersRef.current).forEach(([userId, analyser]) => {
        const dataArray = new Uint8Array((analyser as AnalyserNode).frequencyBinCount);
        (analyser as AnalyserNode).getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        if (avg > 30) {
          setActiveSpeaker(userId);
          setTimeout(() => setActiveSpeaker(prev => prev === userId ? null : prev), 2000);
        }
      });
    };
    const interval = setInterval(checkAudio, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real device switcher track logic
  const changeAudioDevice = async (deviceId: string) => {
    setSelectedAudioId(deviceId);
    setShowAudioMenu(false);
    if (!myStream) return;
    try {
      const constraints = {
        audio: { deviceId: { exact: deviceId } },
        video: isVideoOff ? false : (selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true)
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = myStream.getAudioTracks()[0];
      if (oldAudioTrack) {
        myStream.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
      }
      myStream.addTrack(newAudioTrack);
      
      // Replace for all peer senders
      Object.values(peerRef.current?.connections || {}).forEach((connections: any) => {
        connections.forEach((conn: any) => {
          const sender = conn.peerConnection.getSenders().find((s: any) => s.track && s.track.kind === 'audio');
          if (sender) sender.replaceTrack(newAudioTrack);
        });
      });
      console.log("Successfully switched audio input to", deviceId);
    } catch(err) {
      console.error("Audio switch error:", err);
    }
  };

  const changeVideoDevice = async (deviceId: string) => {
    setSelectedVideoId(deviceId);
    setShowVideoMenu(false);
    if (!myStream) return;
    try {
      const constraints = {
        audio: isMuted ? false : (selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true),
        video: { deviceId: { exact: deviceId } }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = myStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        myStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      myStream.addTrack(newVideoTrack);
      if (myVideoRef.current) myVideoRef.current.srcObject = myStream;

      // Replace for all peer senders
      Object.values(peerRef.current?.connections || {}).forEach((connections: any) => {
        connections.forEach((conn: any) => {
          const sender = conn.peerConnection.getSenders().find((s: any) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack);
        });
      });
      console.log("Successfully switched video input to", deviceId);
    } catch(err) {
      console.error("Video switch error:", err);
    }
  };

  // Host Action handlers
  const toggleWaitingRoomSetting = () => {
    socketRef.current?.emit('host-action', 'toggle-waiting-room');
  };

  const admitWaitingUser = (socketId: string) => {
    socketRef.current?.emit('host-action', 'admit-user', socketId);
  };

  const rejectWaitingUser = (socketId: string) => {
    socketRef.current?.emit('host-action', 'reject-user', socketId);
  };

  const changeRoomPasscode = (newPass: string) => {
    if (!newPass.trim()) return;
    socketRef.current?.emit('host-action', 'change-passcode', newPass);
  };

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

  const copyPasscodeStr = () => {
    navigator.clipboard.writeText(passcode);
    setCopiedPasscode(true);
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  // 1. GUEST WAITING SCREEN
  if (isWaiting) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0F0F10] text-[#E1E1E6]" id="waiting-room-screen">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-[#161618] border border-[#252529] rounded-2xl shadow-2xl text-center space-y-6"
        >
          <div className="w-16 h-16 bg-blue-600/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/15">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Lobby Host Verification</h2>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Hey <span className="text-white font-bold">{userName}</span>, you are currently in the waiting room. The meeting host will admit you shortly.
            </p>
          </div>

          <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-xs space-y-1.5 text-left font-mono">
            <div className="flex justify-between"><span className="text-[#8E8E93]">Meeting ID</span><span className="text-white font-semibold">{roomId}</span></div>
            <div className="flex justify-between"><span className="text-[#8E8E93]">Passcode</span><span className="text-white font-semibold">{passcode}</span></div>
            <div className="flex justify-between"><span className="text-[#8E8E93]">Status</span><span className="text-yellow-400 font-bold">Waiting in Lobby...</span></div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-[#4A4A4F]">
            <Clock className="w-3 h-3 text-[#4A4A4F]" />
            <span>Connecting to SFK Secured Network node</span>
          </div>

          <button 
            onClick={onLeave}
            className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-xs uppercase tracking-wider font-bold transition-all border border-red-500/15 cursor-pointer"
          >
            Leave Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  // 2. STANDARD MEETING SCREEN
  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F0F10] text-[#E1E1E6] overflow-hidden" id="meeting-main-room">
      
      {/* Floating Reactions overlay */}
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

      {/* Header Panel — Meeting ID hidden completely and replaced with secure green shield dropdown */}
      <header className="h-14 border-b border-[#2A2A2E] bg-[#161618] flex items-center justify-between px-6 flex-shrink-0 z-40">
        <div className="flex items-center gap-4 relative">
          
          {/* Zoom-like green shield button */}
          <button
            onClick={() => setShowInfoDropdown(!showInfoDropdown)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all hover:scale-[1.01]"
          >
            <Shield className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Meeting Information</span>
            <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-1.5 rounded">Secure</span>
          </button>

          {/* Secure Information Dropdown Menu */}
          <AnimatePresence>
            {showInfoDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-10 left-0 w-80 bg-[#161618] border border-[#2D2D31] rounded-xl shadow-2xl p-5 z-50 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    Secure Meeting Info
                  </h3>
                  <button onClick={() => setShowInfoDropdown(false)} className="text-[#8E8E93] hover:text-white text-xs">✕</button>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <p className="text-[#8E8E93] text-[10px] uppercase font-bold tracking-widest leading-none">Meeting Purpose</p>
                    <p className="text-white font-semibold mt-1">SFK Academy Class Session</p>
                  </div>

                  <div>
                    <p className="text-[#8E8E93] text-[10px] uppercase font-bold tracking-widest leading-none">Room Host</p>
                    <p className="text-white font-semibold mt-1 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-400" />
                      {hostName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[#8E8E93] text-[10px] uppercase font-bold tracking-widest leading-none">Meeting ID</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono font-bold text-white">{roomId}</span>
                        <button onClick={copyRoomId} className="text-[#8E8E93] hover:text-white transition-colors">
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[#8E8E93] text-[10px] uppercase font-bold tracking-widest leading-none">Passcode</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono font-bold text-white tracking-widest">{passcode}</span>
                        <button onClick={copyPasscodeStr} className="text-[#8E8E93] hover:text-white transition-colors">
                          {copiedPasscode ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <button
                      onClick={copyRoomId}
                      className="w-full py-1.5 bg-[#252529] hover:bg-[#2F2F34] transition-all text-[11px] font-bold uppercase tracking-wider text-blue-400 rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Invite Credentials Link
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner alert if waiting list is populated */}
          {isHost && waitingList.length > 0 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full text-xs text-blue-400 font-bold"
            >
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>{waitingList.length} User waiting in lobby</span>
              <button 
                onClick={() => setShowParticipants(true)}
                className="underline hover:text-white text-[10px] uppercase cursor-pointer"
              >
                View & Admit
              </button>
            </motion.div>
          )}

        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          {isRecording && (
            <div className="flex items-center gap-2 bg-[#2A1414] text-[#FF5C5C] px-3 py-1.5 rounded-full border border-[#421C1C] text-[11px] font-bold uppercase tracking-widest">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5C5C] animate-pulse shrink-0"></span>
              REC {elapsed}
            </div>
          )}
          {!isRecording && (
            <div className="bg-[#1C1C1E] px-3 py-1.5 rounded-full border border-[#2A2A2E] text-[#8E8E93] text-[10px] tracking-wider uppercase font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Unlimited Academy License
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        <section className={`flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-[#0F0F10] transition-all duration-300 ${(showChat || showParticipants) ? 'mr-[280px]' : ''}`}>
          
          {/* My Video viewport */}
          <div className={`relative bg-[#1C1C1E] rounded-xl border-2 transition-all overflow-hidden shadow-lg ${activeSpeaker === 'me' ? 'border-blue-500 scale-[1.01]' : 'border-[#2A2A2E]'}`}>
            <video 
              ref={myVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-[#252529] bg-gradient-to-tr from-[#161618] to-[#252529] flex items-center justify-center">
                <div className="text-3xl font-light text-[#4A4A4F] font-sans">
                  {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute top-3 right-3 flex gap-2 font-bold select-none text-xs">
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
              {userName} (me)
              {isMuted && <MicOff className="w-3.5 h-3.5 text-red-500 ml-1" />}
            </div>
          </div>

          {/* Peer Streams List */}
          {Object.values(peers).map((peer: User) => (
            <VideoTile 
              key={peer.id}
              stream={peer.stream!} 
              name={peer.name} 
              isMuted={peer.isMuted}
              isVideoOff={peer.isVideoOff}
              isHandRaised={peer.isHandRaised}
              isActive={activeSpeaker === peer.id}
            />
          ))}
        </section>

        {/* Floating Sidebars panel */}
        <AnimatePresence>
          {showParticipants && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-[#161618] border-l border-[#2A2A2E] flex flex-col z-20"
            >
              <div className="p-4 border-b border-[#2A2A2E] flex justify-between items-center bg-[#1C1C1E]">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E8E93] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  Room Roster
                </h2>
                <button onClick={() => setShowParticipants(false)} className="p-1 hover:bg-[#2A2A2E] rounded transition-colors">
                  <X className="w-4 h-4 text-[#4A4A4F]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                
                {/* 1. LOBBY WAITING ROOM ACCORDION */}
                {isHost && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center justify-between">
                      <span>Waiting Room Lobby ({waitingList.length})</span>
                      <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                    </span>
                    
                    {waitingList.length === 0 ? (
                      <p className="text-[11px] text-[#4A4A4F] italic leading-relaxed">No participants waiting in the lobby.</p>
                    ) : (
                      <div className="space-y-2">
                        {waitingList.map((item) => (
                          <div key={item.socketId} className="p-2.5 bg-[#0F0F10] rounded-lg border border-white/5 space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-white">
                                {item.name[0]}
                              </div>
                              <span className="font-semibold text-[#E1E1E6] truncate">{item.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => admitWaitingUser(item.socketId)}
                                className="py-1 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase text-white shadow"
                              >
                                Admit
                              </button>
                              <button
                                onClick={() => rejectWaitingUser(item.socketId)}
                                className="py-1 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white rounded text-[10px] font-bold uppercase transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. ACTIVE PARTICIPANTS LIST */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8E8E93]">Active Participants ({Object.keys(peers).length + 1})</span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-400">
                          {userName[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-white truncate">{userName}</p>
                          <p className="text-[9px] text-blue-400 uppercase font-bold leading-none mt-0.5">Host Me</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-[#8E8E93]" />}
                        {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-500" /> : <Video className="w-3.5 h-3.5 text-[#8E8E93]" />}
                      </div>
                    </div>

                    {Object.values(peers).map((peer: User) => (
                      <div key={peer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xs">
                            {peer.name[0]}
                          </div>
                          <span className="text-xs font-semibold truncate max-w-[120px]">{peer.name}</span>
                          {peer.isHandRaised && <span className="text-xs">✋</span>}
                        </div>
                        <div className="flex gap-2">
                          {peer.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-[#8E8E93]" />}
                          {peer.isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-500" /> : <Video className="w-3.5 h-3.5 text-[#8E8E93]" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-[#2A2A2E] bg-[#1C1C1E]">
                <button 
                  onClick={muteAll}
                  disabled={!isHost}
                  className="w-full py-2 bg-red-600/10 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-transparent text-red-500 disabled:text-[#4A4A4F] disabled:bg-transparent disabled:border-[#2A2A2E] rounded text-xs font-bold uppercase transition-all duration-300"
                >
                  Mute All Students
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
              <div className="p-4 border-b border-[#2A2A2E] flex justify-between items-center bg-[#1C1C1E]">
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
                    <p className="text-xs text-[#AEAEB2] leading-relaxed bg-[#1C1C1E]/50 p-2.5 rounded-lg border border-[#2A2A2E]/30 font-sans">
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-[#2A2A2E] bg-[#1C1C1E]">
                <form onSubmit={sendMessage} className="bg-[#252529] rounded-lg p-2.5 flex flex-col gap-2 border border-[#3A3A3C]">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(e))}
                    placeholder="Type to chat..." 
                    className="bg-transparent text-xs text-[#E1E1E6] outline-none resize-none h-12 w-full placeholder:text-[#4A4A4F] leading-normal"
                  ></textarea>
                  <div className="flex justify-end">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-[10px] px-3.5 py-1.5 rounded font-bold text-white transition-colors cursor-pointer">SEND</button>
                  </div>
                </form>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer controls — includes mic and video dropups next to icons */}
      <footer className="h-20 bg-[#161618] border-t border-[#2A2A2E] flex items-center justify-between px-8 flex-shrink-0 z-40">
        
        {/* Hardware source configuration selectors */}
        <div className="flex items-center gap-6">
          
          {/* Mute and Microphones source selector dropdown */}
          <div className="flex items-center gap-1 group relative">
            <div onClick={toggleMute} className="flex flex-col items-center cursor-pointer">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[#252529] border-[#3A3A3C] hover:bg-[#3A3A3C] text-[#E1E1E6]'}`}>
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] mt-1 ${isMuted ? 'text-red-500' : 'text-[#8E8E93]'}`}>{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>
            
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              className="p-1 hover:bg-[#252529] rounded border border-white/5 text-[#8E8E93] hover:text-white"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Custom input device popup menu list */}
            <AnimatePresence>
              {showAudioMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute bottom-16 left-0 w-60 bg-[#1C1C1E] border border-[#3A3A3C] p-1.5 rounded-xl shadow-2xl z-50 text-left"
                >
                  <div className="px-3 py-1 text-[9px] uppercase font-bold text-[#8E8E93] border-b border-white/5 mb-1.5">Select Microphone</div>
                  {audioDevices.length === 0 && <p className="text-[10px] italic text-[#4A4A4F] px-3">No mics found.</p>}
                  {audioDevices.map((dev) => (
                    <button
                      key={dev.deviceId}
                      onClick={() => changeAudioDevice(dev.deviceId)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs truncate flex items-center justify-between gap-1.5 transition-colors ${selectedAudioId === dev.deviceId ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'hover:bg-white/5 text-white/80'}`}
                    >
                      <span className="truncate">{dev.label || `Microphone ${dev.deviceId.slice(0, 4)}`}</span>
                      {selectedAudioId === dev.deviceId && <span className="text-[9px] uppercase font-bold text-blue-400">active</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stop Video & Cameras source selector dropdown */}
          <div className="flex items-center gap-1 group relative">
            <div onClick={toggleVideo} className="flex flex-col items-center cursor-pointer">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[#252529] border-[#3A3A3C] hover:bg-[#3A3A3C] text-[#E1E1E6]'}`}>
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] mt-1 ${isVideoOff ? 'text-red-500' : 'text-[#8E8E93]'}`}>{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </div>

            <button
              onClick={() => setShowVideoMenu(!showVideoMenu)}
              className="p-1 hover:bg-[#252529] rounded border border-white/5 text-[#8E8E93] hover:text-white"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Custom camera device selection list */}
            <AnimatePresence>
              {showVideoMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute bottom-16 left-0 w-60 bg-[#1C1C1E] border border-[#3A3A3C] p-1.5 rounded-xl shadow-2xl z-50 text-left"
                >
                  <div className="px-3 py-1 text-[9px] uppercase font-bold text-[#8E8E93] border-b border-white/5 mb-1.5">Select Video Camera</div>
                  {videoDevices.length === 0 && <p className="text-[10px] italic text-[#4A4A4F] px-3">No cams found.</p>}
                  {videoDevices.map((dev) => (
                    <button
                      key={dev.deviceId}
                      onClick={() => changeVideoDevice(dev.deviceId)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs truncate flex items-center justify-between gap-1.5 transition-colors ${selectedVideoId === dev.deviceId ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'hover:bg-white/5 text-white/80'}`}
                    >
                      <span className="truncate">{dev.label || `Camera ${dev.deviceId.slice(0, 4)}`}</span>
                      {selectedVideoId === dev.deviceId && <span className="text-[9px] uppercase font-bold text-blue-400">active</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Center UI utilities buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowSecurity(false); }} 
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showParticipants ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
              <Users className="w-4 h-4" />
            </div>
            <span className={`text-[10px] mt-1 ${showParticipants ? 'text-blue-400' : 'text-[#8E8E93]'}`}>Participants</span>
          </button>

          <button 
            onClick={() => { setShowChat(!showChat); setShowParticipants(false); setShowSecurity(false); }} 
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showChat ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className={`text-[10px] mt-1 ${showChat ? 'text-blue-400' : 'text-[#8E8E93]'}`}>Chat</span>
          </button>

          {/* Host Security Menu (Host only toggle and parameters) */}
          <div className="relative">
            <button 
              onClick={() => { setShowSecurity(!showSecurity); setShowChat(false); setShowParticipants(false); }} 
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center group-hover:bg-[#3A3A3C] transition-all ${showSecurity ? 'bg-zinc-700 bg-white/10 text-white' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93]'}`}>
                <Settings className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 ${showSecurity ? 'text-white' : 'text-[#8E8E93]'}`}>Security</span>
            </button>
            <AnimatePresence>
              {showSecurity && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 w-52 bg-[#19191B] border border-[#3A3A3C] rounded-xl shadow-2xl overflow-hidden p-2.5 z-50 text-left space-y-2.5"
                >
                  <div className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider border-b border-[#2A2A2E] pb-1.5 mb-1.5">Host Shield Tools</div>
                  
                  {isHost ? (
                    <>
                      {/* Host toggleable waiting room */}
                      <div className="flex items-center justify-between text-xs text-white">
                        <span>Waiting Room</span>
                        <button
                          onClick={toggleWaitingRoomSetting}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${waitingRoomActive ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-[#8E8E93]'}`}
                        >
                          {waitingRoomActive ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <button onClick={muteAll} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/5 rounded flex items-center gap-2 transition-colors text-white/90">
                        <MicOff className="w-3.5 h-3.5 text-blue-400" /> Mute All Students
                      </button>

                      <button onClick={() => socketRef.current?.emit('host-action', 'stop-video-all')} className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/5 rounded flex items-center gap-2 transition-colors text-white/90">
                        <VideoOff className="w-3.5 h-3.5 text-blue-400" /> Stop All Cameras
                      </button>

                      <div className="border-t border-white/5 pt-2 space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-[#8E8E93] tracking-widest leading-none">Modify Passcode</label>
                        <input
                          type="text"
                          defaultValue={passcode}
                          onBlur={(e) => changeRoomPasscode(e.target.value)}
                          className="w-full bg-[#0F0F10] border border-[#2a2a2d] text-white text-[10px] py-1 px-2 rounded outline-none text-center font-mono tracking-widest"
                          placeholder="Passcode"
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#4A4A4F] italic leading-relaxed">Safety metrics configured by Room Host ({hostName}).</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 group">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-900/35 border-green-600/50 text-green-400' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93] group-hover:bg-[#3A3A3C]'}`}>
              <Monitor className="w-4 h-4" />
            </div>
            <span className={`text-[10px] mt-1 ${isScreenSharing ? 'text-green-400 font-semibold' : 'text-[#8E8E93]'}`}>Share Screen</span>
          </button>

          {/* Client Reactions triggers list */}
          <div className="flex items-center h-10 bg-[#252529] border border-[#3A3A3C] rounded-full px-2 gap-1 mx-2">
            <button onClick={toggleHandRaise} className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-all ${isHandRaised ? 'bg-yellow-500 text-black font-semibold' : ''}`} title="Raise Hand">✋</button>
            <button onClick={() => sendReaction('❤️')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-all">❤️</button>
            <button onClick={() => sendReaction('👏')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-all">👏</button>
            <button onClick={() => sendReaction('😂')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#3A3A3C] transition-all">😂</button>
          </div>

          <button onClick={isRecording ? stopRecording : startRecording} className="flex flex-col items-center gap-1 group animate-fade-in">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isRecording ? 'bg-[#2A1414] border-[#421C1C] text-[#FF5C5C]' : 'bg-[#252529] border-[#3A3A3C] text-[#8E8E93] group-hover:bg-[#3A3A3C]'}`}>
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-[#FF5C5C] animate-pulse' : 'bg-[#8E8E93]'}`}></div>
            </div>
            <span className={`text-[10px] mt-1 ${isRecording ? 'text-[#FF5C5C] font-semibold' : 'text-[#8E8E93]'}`}>{isRecording ? 'Stop Rec' : 'Recording'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onLeave} 
            className="bg-[#2A1414] hover:bg-red-600/20 text-[#FF5C5C] px-6 py-2.5 rounded-lg font-bold text-xs tracking-wider uppercase transition-all border border-[#421C1C] hover:border-red-500/30 flex items-center gap-2 cursor-pointer"
          >
            Leave Meet
            <PhoneOff className="w-4 h-4 animate-pulse" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function VideoTile({ stream, name, isMuted, isVideoOff, isHandRaised, isActive }: { stream: MediaStream; name: string; isMuted?: boolean; isVideoOff?: boolean; isHandRaised?: boolean; isActive?: boolean; key?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-[#1C1C1E] rounded-xl border-2 transition-all duration-300 overflow-hidden shadow-md aspect-video group ${isActive ? 'border-blue-500 scale-[1.01]' : 'border-[#2A2A2E]'}`}>
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
      <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-medium border border-white/5 flex items-center gap-2">
        {isActive && (
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-1 bg-blue-400 h-1"></div>
            <div className="w-1 bg-blue-400 h-2"></div>
            <div className="w-1 bg-blue-400 h-3"></div>
          </div>
        )}
        {name}
        {isMuted && <MicOff className="w-3.5 h-3.5 text-red-500 ml-1" />}
      </div>
    </div>
  );
}
