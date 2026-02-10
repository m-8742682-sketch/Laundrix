/**
 * i18n - Internationalization Support
 * 
 * Supports: English (en), Malay (ms)
 * Saves language preference to Firestore users/{uid}/language
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase";

// Available languages
export type Language = "en" | "ms";

// Translation keys - ALL strings in the app
export interface Translations {
  // Common
  loading: string;
  error: string;
  cancel: string;
  save: string;
  delete: string;
  edit: string;
  confirm: string;
  back: string;
  next: string;
  done: string;
  ok: string;
  yes: string;
  no: string;
  search: string;
  refresh: string;
  retry: string;
  close: string;
  submit: string;
  clear: string;
  clearAll: string;
  goBack: string;
  online: string;
  offline: string;
  activeNow: string;
  busy: string;
  away: string;
  live: string;
  leave: string;
  use: string;
  mute: string;
  flip: string;
  speaker: string;
  camera: string;
  
  // Auth
  login: string;
  register: string;
  logout: string;
  signOut: string;
  email: string;
  emailAddress: string;
  password: string;
  confirmPassword: string;
  forgotPassword: string;
  resetPassword: string;
  signIn: string;
  signUp: string;
  welcomeBack: string;
  createAccount: string;
  continueWithGoogle: string;
  orContinueWith: string;
  newToLaundrix: string;
  alreadyHaveAccount: string;
  joinLaundrix: string;
  fullName: string;
  freshCleanStart: string;
  backToSignIn: string;
  
  // Dashboard
  dashboard: string;
  welcomeUser: string;
  quickActions: string;
  scanQR: string;
  scanQRCode: string;
  scanNow: string;
  scanToStart: string;
  howToScan: string;
  viewHistory: string;
  notifications: string;
  settings: string;
  activeMachines: string;
  availableMachines: string;
  available: string;
  myActiveSessions: string;
  noActiveSessions: string;
  machineStatus: string;
  activeSession: string;
  sessions: string;
  otherMachines: string;
  primaryWasher: string;
  machineReady: string;
  running: string;
  
  // Queue
  queue: string;
  liveQueue: string;
  joinQueue: string;
  leaveQueue: string;
  joining: string;
  leaving: string;
  queuePosition: string;
  yourPosition: string;
  estimatedWait: string;
  peopleInQueue: string;
  peopleWaiting: string;
  yourTurn: string;
  notYourTurn: string;
  goAhead: string;
  emptyQueue: string;
  queueEmpty: string;
  beFirstToJoin: string;
  queueNotification: string;
  queueReminders: string;
  queueRing: string;
  ringWhenMyTurn: string;
  whenAlmostYourTurn: string;
  inQueue: string;
  inUse: string;
  you: string;
  joined: string;
  
  // History
  history: string;
  usageHistory: string;
  noHistory: string;
  noHistoryYet: string;
  machineUsed: string;
  duration: string;
  date: string;
  status: string;
  completed: string;
  cancelled: string;
  loadingHistory: string;
  
  // Conversations
  conversations: string;
  messages: string;
  noConversations: string;
  startChat: string;
  startAChat: string;
  newChat: string;
  typeMessage: string;
  voiceMessage: string;
  unreadMessages: string;
  loadingConversations: string;
  loadingUsers: string;
  
  // Contact/Chat
  sendMessage: string;
  messageHint: string;
  deleteMessage: string;
  editMessage: string;
  deleteForEveryone: string;
  today: string;
  yesterday: string;
  unread: string;
  
  // Notifications
  allNotifications: string;
  markAllAsRead: string;
  noNotifications: string;
  noNotificationsYet: string;
  loadingNotifications: string;
  testNotifications: string;
  swipeLeftToDelete: string;
  
  // Settings
  profile: string;
  account: string;
  accountActions: string;
  language: string;
  selectLanguage: string;
  english: string;
  malay: string;
  notificationSettings: string;
  enableNotifications: string;
  enableAllAlerts: string;
  enableOrDisableAllAlerts: string;
  machineReadyAlerts: string;
  whenLaundryDone: string;
  helpCenter: string;
  helpSupport: string;
  haveQuestions: string;
  wereHereToHelp: string;
  stillNeedHelp: string;
  contactSupport: string;
  contactOptional: string;
  faq: string;
  troubleshooting: string;
  privacyPolicy: string;
  termsOfService: string;
  terms: string;
  aboutUs: string;
  aboutLaundrix: string;
  version: string;
  versionNumber: string;
  preferences: string;
  pushNotifications: string;
  alerts: string;
  legalPrivacy: string;
  policiesDisclosures: string;
  disclosures: string;
  loadingProfile: string;
  saveChanges: string;
  tapToChangePhoto: string;
  memberSince: string;
  
  // Machine/IoT
  machine: string;
  machineId: string;
  machineM001: string;
  scanMachine: string;
  startMachine: string;
  startInstantly: string;
  stopMachine: string;
  releaseMachine: string;
  machineRunning: string;
  machineIdle: string;
  machineInUse: string;
  machineNotFound: string;
  estimatedTime: string;
  vibrationLevel: string;
  vibration: string;
  currentLoad: string;
  load: string;
  kg: string;
  door: string;
  buzzerActive: string;
  controlPanel: string;
  sensorData: string;
  connectingToMachine: string;
  verifyingAccess: string;
  cameraPermissionRequired: string;
  someoneAtYourMachine: string;
  secondsRemaining: string;
  secondsToRespond: string;
  
  // Calls
  voiceCall: string;
  videoCall: string;
  incomingCall: string;
  outgoingCall: string;
  missedCall: string;
  callEnded: string;
  calling: string;
  connecting: string;
  
  // Errors
  errorOccurred: string;
  networkError: string;
  permissionDenied: string;
  invalidCredentials: string;
  userNotFound: string;
  emailInUse: string;
  weakPassword: string;
  
  // AI Assistant
  aiAssistant: string;
  poweredByGemini: string;
  thinking: string;
  
  // Admin
  adminDashboard: string;
  
  // Data
  dataStorage: string;
  internetAccess: string;
}

// English translations
const en: Translations = {
  // Common
  loading: "Loading...",
  error: "Error",
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  edit: "Edit",
  confirm: "Confirm",
  back: "Back",
  next: "Next",
  done: "Done",
  ok: "OK",
  yes: "Yes",
  no: "No",
  search: "Search",
  refresh: "Refresh",
  retry: "Retry",
  close: "Close",
  submit: "Submit",
  clear: "Clear",
  clearAll: "Clear All",
  goBack: "Go Back",
  online: "Online",
  offline: "Offline",
  activeNow: "Active now",
  busy: "Busy",
  away: "Away",
  live: "Live",
  leave: "Leave",
  use: "Use",
  mute: "Mute",
  flip: "Flip",
  speaker: "Speaker",
  camera: "Camera",
  
  // Auth
  login: "Login",
  register: "Register",
  logout: "Logout",
  signOut: "Sign Out",
  email: "Email",
  emailAddress: "Email Address",
  password: "Password",
  confirmPassword: "Confirm Password",
  forgotPassword: "Forgot password?",
  resetPassword: "Reset Password",
  signIn: "Sign In",
  signUp: "Sign Up",
  welcomeBack: "Welcome Back!",
  createAccount: "Create Account",
  continueWithGoogle: "Continue with Google",
  orContinueWith: "or continue with",
  newToLaundrix: "New to Laundrix?",
  alreadyHaveAccount: "Already have an account?",
  joinLaundrix: "Join Laundrix",
  fullName: "Full Name",
  freshCleanStart: "Fresh & Clean starts here",
  backToSignIn: "Back to Sign In",
  
  // Dashboard
  dashboard: "Dashboard",
  welcomeUser: "Welcome",
  quickActions: "Quick Actions",
  scanQR: "Scan QR",
  scanQRCode: "Scan QR Code",
  scanNow: "Scan Now",
  scanToStart: "Scan to Start",
  howToScan: "How to scan:",
  viewHistory: "View History",
  notifications: "Notifications",
  settings: "Settings",
  activeMachines: "Active Machines",
  availableMachines: "Available Machines",
  available: "Available",
  myActiveSessions: "My Active Sessions",
  noActiveSessions: "No active sessions",
  machineStatus: "Machine Status",
  activeSession: "Active Session",
  sessions: "sessions",
  otherMachines: "Other Machines",
  primaryWasher: "Primary Washer",
  machineReady: "Machine Ready",
  running: "RUNNING",
  
  // Queue
  queue: "Queue",
  liveQueue: "Live Queue",
  joinQueue: "Join Queue",
  leaveQueue: "Leave Queue",
  joining: "Joining...",
  leaving: "Leaving...",
  queuePosition: "Queue Position",
  yourPosition: "Your Position",
  estimatedWait: "Estimated Wait",
  peopleInQueue: "people in queue",
  peopleWaiting: "People Waiting",
  yourTurn: "It's your turn!",
  notYourTurn: "Not Your Turn!",
  goAhead: "Go ahead!",
  emptyQueue: "No one in queue",
  queueEmpty: "Queue is Empty",
  beFirstToJoin: "Be the first to join!",
  queueNotification: "Queue Notification",
  queueReminders: "Queue Reminders",
  queueRing: "Queue Ring",
  ringWhenMyTurn: "Ring when it's my turn",
  whenAlmostYourTurn: "When it's almost your turn",
  inQueue: "In Queue",
  inUse: "In Use",
  you: "You",
  joined: "Joined",
  
  // History
  history: "History",
  usageHistory: "Usage History",
  noHistory: "No usage history yet",
  noHistoryYet: "No history yet",
  machineUsed: "Machine Used",
  duration: "Duration",
  date: "Date",
  status: "Status",
  completed: "Completed",
  cancelled: "Cancelled",
  loadingHistory: "Loading history...",
  
  // Conversations
  conversations: "Conversations",
  messages: "Messages",
  noConversations: "No conversations yet",
  startChat: "Start a chat",
  startAChat: "Start a Chat",
  newChat: "New Chat",
  typeMessage: "Type a message",
  voiceMessage: "Voice message",
  unreadMessages: "unread messages",
  loadingConversations: "Loading conversations...",
  loadingUsers: "Loading users...",
  
  // Contact/Chat
  sendMessage: "Send Message",
  messageHint: "Message...",
  deleteMessage: "Delete Message",
  editMessage: "Edit Message",
  deleteForEveryone: "Delete for everyone",
  today: "Today",
  yesterday: "Yesterday",
  unread: "Unread",
  
  // Notifications
  allNotifications: "All Notifications",
  markAllAsRead: "Mark all as read",
  noNotifications: "No notifications",
  noNotificationsYet: "No notifications yet",
  loadingNotifications: "Loading notifications...",
  testNotifications: "Test Notifications",
  swipeLeftToDelete: "Swipe left to delete",
  
  // Settings
  profile: "Profile",
  account: "Account",
  accountActions: "Account Actions",
  language: "Language",
  selectLanguage: "Select Language",
  english: "English",
  malay: "Bahasa Melayu",
  notificationSettings: "Notification Settings",
  enableNotifications: "Enable Notifications",
  enableAllAlerts: "Enable All Alerts",
  enableOrDisableAllAlerts: "Enable or disable all alerts",
  machineReadyAlerts: "Machine Ready Alerts",
  whenLaundryDone: "When your laundry is done",
  helpCenter: "Help Center",
  helpSupport: "Help & Support",
  haveQuestions: "Have Questions?",
  wereHereToHelp: "We're here to help",
  stillNeedHelp: "Still need help?",
  contactSupport: "Contact Support",
  contactOptional: "Contact (Optional)",
  faq: "Frequently Asked Questions",
  troubleshooting: "Troubleshooting",
  privacyPolicy: "Privacy Policy",
  termsOfService: "Terms of Service",
  terms: "Terms",
  aboutUs: "About Us",
  aboutLaundrix: "About Laundrix",
  version: "Version",
  versionNumber: "Version 1.0.0",
  preferences: "Preferences",
  pushNotifications: "Push Notifications",
  alerts: "Alerts",
  legalPrivacy: "Legal & Privacy",
  policiesDisclosures: "Policies & Disclosures",
  disclosures: "Disclosures",
  loadingProfile: "Loading profile...",
  saveChanges: "Save Changes",
  tapToChangePhoto: "Tap to change photo",
  memberSince: "Member Since",
  
  // Machine/IoT
  machine: "Machine",
  machineId: "Machine ID",
  machineM001: "Machine M001",
  scanMachine: "Scan Machine",
  startMachine: "Start Machine",
  startInstantly: "Start instantly",
  stopMachine: "Stop Machine",
  releaseMachine: "Release Machine",
  machineRunning: "Machine Running",
  machineIdle: "Machine Idle",
  machineInUse: "In Use",
  machineNotFound: "Machine not found",
  estimatedTime: "Estimated Time",
  vibrationLevel: "Vibration Level",
  vibration: "Vibration",
  currentLoad: "Current Load",
  load: "Load",
  kg: "kg",
  door: "Door",
  buzzerActive: "Buzzer Active",
  controlPanel: "Control Panel",
  sensorData: "Sensor Data",
  connectingToMachine: "Connecting to machine...",
  verifyingAccess: "Verifying access…",
  cameraPermissionRequired: "Camera permission required",
  someoneAtYourMachine: "Someone at Your Machine!",
  secondsRemaining: "seconds remaining",
  secondsToRespond: "seconds to respond",
  
  // Calls
  voiceCall: "Voice Call",
  videoCall: "Video Call",
  incomingCall: "Incoming Call",
  outgoingCall: "Outgoing Call",
  missedCall: "Missed Call",
  callEnded: "Call Ended",
  calling: "Calling...",
  connecting: "Connecting...",
  
  // Errors
  errorOccurred: "An error occurred",
  networkError: "Network error. Please check your connection.",
  permissionDenied: "Permission denied",
  invalidCredentials: "Invalid email or password",
  userNotFound: "User not found",
  emailInUse: "Email already in use",
  weakPassword: "Password is too weak",
  
  // AI Assistant
  aiAssistant: "AI Assistant",
  poweredByGemini: "Powered by Gemini",
  thinking: "Thinking...",
  
  // Admin
  adminDashboard: "Admin Dashboard",
  
  // Data
  dataStorage: "Data Storage",
  internetAccess: "Internet Access",
};

// Malay translations
const ms: Translations = {
  // Common
  loading: "Memuatkan...",
  error: "Ralat",
  cancel: "Batal",
  save: "Simpan",
  delete: "Padam",
  edit: "Sunting",
  confirm: "Sahkan",
  back: "Kembali",
  next: "Seterusnya",
  done: "Selesai",
  ok: "OK",
  yes: "Ya",
  no: "Tidak",
  search: "Cari",
  refresh: "Muat Semula",
  retry: "Cuba Lagi",
  close: "Tutup",
  submit: "Hantar",
  clear: "Kosongkan",
  clearAll: "Kosongkan Semua",
  goBack: "Kembali",
  online: "Dalam Talian",
  offline: "Luar Talian",
  activeNow: "Aktif sekarang",
  busy: "Sibuk",
  away: "Tiada",
  live: "Langsung",
  leave: "Keluar",
  use: "Guna",
  mute: "Senyap",
  flip: "Balik",
  speaker: "Pembesar Suara",
  camera: "Kamera",
  
  // Auth
  login: "Log Masuk",
  register: "Daftar",
  logout: "Log Keluar",
  signOut: "Log Keluar",
  email: "E-mel",
  emailAddress: "Alamat E-mel",
  password: "Kata Laluan",
  confirmPassword: "Sahkan Kata Laluan",
  forgotPassword: "Lupa kata laluan?",
  resetPassword: "Tetap Semula Kata Laluan",
  signIn: "Log Masuk",
  signUp: "Daftar",
  welcomeBack: "Selamat Kembali!",
  createAccount: "Cipta Akaun",
  continueWithGoogle: "Teruskan dengan Google",
  orContinueWith: "atau teruskan dengan",
  newToLaundrix: "Baru di Laundrix?",
  alreadyHaveAccount: "Sudah ada akaun?",
  joinLaundrix: "Sertai Laundrix",
  fullName: "Nama Penuh",
  freshCleanStart: "Kesegaran & Kebersihan bermula di sini",
  backToSignIn: "Kembali ke Log Masuk",
  
  // Dashboard
  dashboard: "Papan Pemuka",
  welcomeUser: "Selamat Datang",
  quickActions: "Tindakan Pantas",
  scanQR: "Imbas QR",
  scanQRCode: "Imbas Kod QR",
  scanNow: "Imbas Sekarang",
  scanToStart: "Imbas untuk Mula",
  howToScan: "Cara mengimbas:",
  viewHistory: "Lihat Sejarah",
  notifications: "Pemberitahuan",
  settings: "Tetapan",
  activeMachines: "Mesin Aktif",
  availableMachines: "Mesin Tersedia",
  available: "Tersedia",
  myActiveSessions: "Sesi Aktif Saya",
  noActiveSessions: "Tiada sesi aktif",
  machineStatus: "Status Mesin",
  activeSession: "Sesi Aktif",
  sessions: "sesi",
  otherMachines: "Mesin Lain",
  primaryWasher: "Mesin Basuh Utama",
  machineReady: "Mesin Sedia",
  running: "BERJALAN",
  
  // Queue
  queue: "Barisan",
  liveQueue: "Barisan Langsung",
  joinQueue: "Sertai Barisan",
  leaveQueue: "Tinggalkan Barisan",
  joining: "Menyertai...",
  leaving: "Meninggalkan...",
  queuePosition: "Kedudukan Barisan",
  yourPosition: "Kedudukan Anda",
  estimatedWait: "Anggaran Menunggu",
  peopleInQueue: "orang dalam barisan",
  peopleWaiting: "Orang Menunggu",
  yourTurn: "Giliran anda!",
  notYourTurn: "Bukan Giliran Anda!",
  goAhead: "Teruskan!",
  emptyQueue: "Tiada sesiapa dalam barisan",
  queueEmpty: "Barisan Kosong",
  beFirstToJoin: "Jadilah yang pertama menyertai!",
  queueNotification: "Pemberitahuan Barisan",
  queueReminders: "Peringatan Barisan",
  queueRing: "Bunyi Barisan",
  ringWhenMyTurn: "Berbunyi apabila giliran saya",
  whenAlmostYourTurn: "Apabila hampir giliran anda",
  inQueue: "Dalam Barisan",
  inUse: "Sedang Digunakan",
  you: "Anda",
  joined: "Menyertai",
  
  // History
  history: "Sejarah",
  usageHistory: "Sejarah Penggunaan",
  noHistory: "Tiada sejarah penggunaan lagi",
  noHistoryYet: "Tiada sejarah lagi",
  machineUsed: "Mesin Digunakan",
  duration: "Tempoh",
  date: "Tarikh",
  status: "Status",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  loadingHistory: "Memuatkan sejarah...",
  
  // Conversations
  conversations: "Perbualan",
  messages: "Mesej",
  noConversations: "Tiada perbualan lagi",
  startChat: "Mulakan perbualan",
  startAChat: "Mulakan Perbualan",
  newChat: "Perbualan Baru",
  typeMessage: "Taip mesej",
  voiceMessage: "Mesej suara",
  unreadMessages: "mesej belum dibaca",
  loadingConversations: "Memuatkan perbualan...",
  loadingUsers: "Memuatkan pengguna...",
  
  // Contact/Chat
  sendMessage: "Hantar Mesej",
  messageHint: "Mesej...",
  deleteMessage: "Padam Mesej",
  editMessage: "Sunting Mesej",
  deleteForEveryone: "Padam untuk semua orang",
  today: "Hari Ini",
  yesterday: "Semalam",
  unread: "Belum Dibaca",
  
  // Notifications
  allNotifications: "Semua Pemberitahuan",
  markAllAsRead: "Tandai semua sebagai dibaca",
  noNotifications: "Tiada pemberitahuan",
  noNotificationsYet: "Tiada pemberitahuan lagi",
  loadingNotifications: "Memuatkan pemberitahuan...",
  testNotifications: "Uji Pemberitahuan",
  swipeLeftToDelete: "Leret ke kiri untuk memadam",
  
  // Settings
  profile: "Profil",
  account: "Akaun",
  accountActions: "Tindakan Akaun",
  language: "Bahasa",
  selectLanguage: "Pilih Bahasa",
  english: "English",
  malay: "Bahasa Melayu",
  notificationSettings: "Tetapan Pemberitahuan",
  enableNotifications: "Aktifkan Pemberitahuan",
  enableAllAlerts: "Aktifkan Semua Amaran",
  enableOrDisableAllAlerts: "Aktif atau nyahaktif semua amaran",
  machineReadyAlerts: "Amaran Mesin Sedia",
  whenLaundryDone: "Apabila cucian anda selesai",
  helpCenter: "Pusat Bantuan",
  helpSupport: "Bantuan & Sokongan",
  haveQuestions: "Ada Soalan?",
  wereHereToHelp: "Kami di sini untuk membantu",
  stillNeedHelp: "Masih perlukan bantuan?",
  contactSupport: "Hubungi Sokongan",
  contactOptional: "Hubungan (Pilihan)",
  faq: "Soalan Lazim",
  troubleshooting: "Penyelesaian Masalah",
  privacyPolicy: "Polisi Privasi",
  termsOfService: "Terma Perkhidmatan",
  terms: "Terma",
  aboutUs: "Tentang Kami",
  aboutLaundrix: "Tentang Laundrix",
  version: "Versi",
  versionNumber: "Versi 1.0.0",
  preferences: "Keutamaan",
  pushNotifications: "Pemberitahuan Tolak",
  alerts: "Amaran",
  legalPrivacy: "Undang-undang & Privasi",
  policiesDisclosures: "Polisi & Pendedahan",
  disclosures: "Pendedahan",
  loadingProfile: "Memuatkan profil...",
  saveChanges: "Simpan Perubahan",
  tapToChangePhoto: "Ketik untuk tukar foto",
  memberSince: "Ahli Sejak",
  
  // Machine/IoT
  machine: "Mesin",
  machineId: "ID Mesin",
  machineM001: "Mesin M001",
  scanMachine: "Imbas Mesin",
  startMachine: "Mulakan Mesin",
  startInstantly: "Mula serta-merta",
  stopMachine: "Hentikan Mesin",
  releaseMachine: "Lepaskan Mesin",
  machineRunning: "Mesin Berjalan",
  machineIdle: "Mesin Sedia",
  machineInUse: "Sedang Digunakan",
  machineNotFound: "Mesin tidak dijumpai",
  estimatedTime: "Anggaran Masa",
  vibrationLevel: "Tahap Getaran",
  vibration: "Getaran",
  currentLoad: "Muatan Semasa",
  load: "Muatan",
  kg: "kg",
  door: "Pintu",
  buzzerActive: "Buzzer Aktif",
  controlPanel: "Panel Kawalan",
  sensorData: "Data Sensor",
  connectingToMachine: "Menyambung ke mesin...",
  verifyingAccess: "Mengesahkan akses…",
  cameraPermissionRequired: "Kebenaran kamera diperlukan",
  someoneAtYourMachine: "Seseorang di Mesin Anda!",
  secondsRemaining: "saat berbaki",
  secondsToRespond: "saat untuk menjawab",
  
  // Calls
  voiceCall: "Panggilan Suara",
  videoCall: "Panggilan Video",
  incomingCall: "Panggilan Masuk",
  outgoingCall: "Panggilan Keluar",
  missedCall: "Panggilan Terlepas",
  callEnded: "Panggilan Tamat",
  calling: "Memanggil...",
  connecting: "Menyambung...",
  
  // Errors
  errorOccurred: "Ralat berlaku",
  networkError: "Ralat rangkaian. Sila semak sambungan anda.",
  permissionDenied: "Kebenaran ditolak",
  invalidCredentials: "E-mel atau kata laluan tidak sah",
  userNotFound: "Pengguna tidak dijumpai",
  emailInUse: "E-mel sudah digunakan",
  weakPassword: "Kata laluan terlalu lemah",
  
  // AI Assistant
  aiAssistant: "Pembantu AI",
  poweredByGemini: "Dikuasakan oleh Gemini",
  thinking: "Berfikir...",
  
  // Admin
  adminDashboard: "Papan Pemuka Admin",
  
  // Data
  dataStorage: "Storan Data",
  internetAccess: "Akses Internet",
};

const translations: Record<Language, Translations> = { en, ms };

interface I18nContextValue {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const STORAGE_KEY = "@laundrix_language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "en" || stored === "ms")) {
        setLanguageState(stored);
      }
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const firestoreLang = userDoc.data()?.language;
          if (firestoreLang === "en" || firestoreLang === "ms") {
            setLanguageState(firestoreLang);
            await AsyncStorage.setItem(STORAGE_KEY, firestoreLang);
          }
        }
      }
    } catch (error) {
      console.warn("[i18n] Error loading language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(STORAGE_KEY, lang);
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { language: lang });
      }
    } catch (error) {
      console.error("[i18n] Error saving language:", error);
    }
  }, []);

  const value: I18nContextValue = {
    language,
    t: translations[language],
    setLanguage,
    isLoading,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useTranslations() {
  const { t } = useI18n();
  return t;
}

export default { I18nProvider, useI18n, useTranslations };
