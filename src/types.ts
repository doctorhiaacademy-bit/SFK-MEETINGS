export interface User {
  id: string;
  name: string;
  stream?: MediaStream;
  isMe?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  isHost?: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}
