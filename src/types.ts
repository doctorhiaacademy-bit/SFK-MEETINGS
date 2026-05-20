export interface User {
  id: string;
  name: string;
  email?: string;
  stream?: MediaStream;
  isMe?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  isHost?: boolean;
  isWaiting?: boolean; // Waiting room indicator
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface MediaDeviceChoice {
  id: string;
  label: string;
}

export interface AppUserRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  signUpDate: string;
  loginMethod: 'Google' | 'Guest' | 'Email';
  totalMeetingsJoined: number;
}

export interface DownloadRecord {
  id: string;
  platform: 'Windows' | 'macOS' | 'Linux' | 'iOS' | 'Android';
  date: string;
  version: string;
  ipPlaceholder: string;
}
