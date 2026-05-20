import { AppUserRecord, DownloadRecord } from './types';

const INITIAL_USERS: AppUserRecord[] = [
  {
    id: 'user-sfk-01',
    name: 'Amina Khan',
    email: 'amina.khan@sfkacademy.com',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=85&w=150&h=150',
    signUpDate: '2026-05-10T10:14:22Z',
    loginMethod: 'Email',
    totalMeetingsJoined: 18
  },
  {
    id: 'user-sfk-02',
    name: 'Ali Abbas',
    email: 'ali.abbas@sfkacademy.com',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=85&w=150&h=150',
    signUpDate: '2026-05-12T08:31:05Z',
    loginMethod: 'Google',
    totalMeetingsJoined: 24
  },
  {
    id: 'user-sfk-03',
    name: 'Sarah Smith',
    email: 'sarah.smith@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=85&w=150&h=150',
    signUpDate: '2026-05-14T15:20:10Z',
    loginMethod: 'Google',
    totalMeetingsJoined: 9
  },
  {
    id: 'user-sfk-04',
    name: 'Fahad Khan',
    email: 'sfkshahfahadkhan@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=85&w=150&h=150',
    signUpDate: '2026-05-15T12:00:00Z',
    loginMethod: 'Google',
    totalMeetingsJoined: 42
  },
  {
    id: 'user-sfk-05',
    name: 'Mariam G.',
    email: 'mariam.g@sfkacademy.com',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=85&w=150&h=150',
    signUpDate: '2026-05-17T09:44:12Z',
    loginMethod: 'Guest',
    totalMeetingsJoined: 5
  }
];

const INITIAL_DOWNLOADS: DownloadRecord[] = [
  { id: 'dl-1', platform: 'Windows', date: '2026-05-14T11:24:00Z', version: 'v1.4.2', ipPlaceholder: '182.164.x.x' },
  { id: 'dl-2', platform: 'macOS', date: '2026-05-14T14:55:00Z', version: 'v1.4.2', ipPlaceholder: '84.22.x.x' },
  { id: 'dl-3', platform: 'macOS', date: '2026-05-15T09:12:00Z', version: 'v1.4.2', ipPlaceholder: '103.5.x.x' },
  { id: 'dl-4', platform: 'Windows', date: '2026-05-15T18:41:00Z', version: 'v1.4.2', ipPlaceholder: '45.195.x.x' },
  { id: 'dl-5', platform: 'Linux', date: '2026-05-16T08:02:00Z', version: 'v1.4.2', ipPlaceholder: '201.88.x.x' },
  { id: 'dl-6', platform: 'Windows', date: '2026-05-16T13:14:00Z', version: 'v1.4.2', ipPlaceholder: '181.56.x.x' },
  { id: 'dl-7', platform: 'Windows', date: '2026-05-17T10:20:00Z', version: 'v1.4.2', ipPlaceholder: '89.44.x.x' },
  { id: 'dl-8', platform: 'macOS', date: '2026-05-17T15:30:00Z', version: 'v1.4.2', ipPlaceholder: '194.2.x.x' },
  { id: 'dl-9', platform: 'iOS', date: '2026-05-18T07:11:00Z', version: 'v1.4.2', ipPlaceholder: '110.12.x.x' },
  { id: 'dl-10', platform: 'Android', date: '2026-05-18T12:04:00Z', version: 'v1.4.2', ipPlaceholder: '67.243.x.x' },
  { id: 'dl-11', platform: 'Windows', date: '2026-05-19T14:45:00Z', version: 'v1.4.2', ipPlaceholder: '109.81.x.x' },
  { id: 'dl-12', platform: 'Windows', date: '2026-05-19T21:00:00Z', version: 'v1.4.2', ipPlaceholder: '90.111.x.x' },
  { id: 'dl-13', platform: 'macOS', date: '2026-05-20T08:30:00Z', version: 'v1.4.2', ipPlaceholder: '203.11.x.x' },
  { id: 'dl-14', platform: 'Android', date: '2026-05-20T11:15:00Z', version: 'v1.4.2', ipPlaceholder: '45.12.x.x' }
];

export function getRegistryUsers(): AppUserRecord[] {
  const usersStr = localStorage.getItem('sfk_users_registry');
  if (!usersStr) {
    localStorage.setItem('sfk_users_registry', JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(usersStr);
}

export function saveRegistryUser(user: AppUserRecord) {
  const users = getRegistryUsers();
  const existingIndex = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existingIndex !== -1) {
    users[existingIndex] = { ...users[existingIndex], ...user };
  } else {
    users.unshift(user);
  }
  localStorage.setItem('sfk_users_registry', JSON.stringify(users));
}

export function getRegistryDownloads(): DownloadRecord[] {
  const dlStr = localStorage.getItem('sfk_downloads_registry');
  if (!dlStr) {
    localStorage.setItem('sfk_downloads_registry', JSON.stringify(INITIAL_DOWNLOADS));
    return INITIAL_DOWNLOADS;
  }
  return JSON.parse(dlStr);
}

export function recordDownload(platform: 'Windows' | 'macOS' | 'Linux' | 'iOS' | 'Android') {
  const dls = getRegistryDownloads();
  const newRecord: DownloadRecord = {
    id: 'dl-' + Math.random().toString(36).substring(2, 9),
    platform,
    date: new Date().toISOString(),
    version: 'v1.4.2',
    ipPlaceholder: `${Math.floor(Math.random() * 210) + 12}.${Math.floor(Math.random() * 240) + 10}.x.x`
  };
  dls.unshift(newRecord);
  localStorage.setItem('sfk_downloads_registry', JSON.stringify(dls));
  return dls;
}

// Session authentication and PMI config
export interface ActiveSession {
  name: string;
  email: string;
  avatarUrl: string;
  personalMeetingId: string;
  usePmiForNewMeetings: boolean;
  loginMethod: 'Google' | 'Guest' | 'Email';
}

export function getActiveSession(): ActiveSession | null {
  const sessionStr = localStorage.getItem('sfk_active_session');
  if (!sessionStr) return null;
  return JSON.parse(sessionStr);
}

export function saveActiveSession(session: ActiveSession) {
  localStorage.setItem('sfk_active_session', JSON.stringify(session));
}

export function clearActiveSession() {
  localStorage.removeItem('sfk_active_session');
}
