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

// Translation keys - ALL strings in the app (Duplicates removed)
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
  status: string;
  min: string; // minutes abbreviation
  
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
  hi: string;
  user: string;
  welcomeUser: string;
  freshAndCleanStartsHere: string;
  loadingLaundrix: string;
  quickActions: string;
  scanQR: string;
  scanQRCode: string;
  scanNow: string;
  scanToStart: string;
  startInstantly: string;
  howToScan: string;
  viewHistory: string;
  notifications: string;
  settings: string;
  activeMachines: string;
  availableMachines: string;
  available: string;
  waiting: string;
  myActiveSessions: string;
  noActiveSessions: string;
  machineStatus: string;
  minutesLeft: string,  // or "minutes remaining"
  activeSession: string;
  sessions: string;
  otherMachines: string;
  primaryWasher: string;
  machineReady: string;
  readyForYourLaundry: string;
  currentlyInUse: string;
  readyForDuty: string;
  washInProgress: string;
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
  historyWillAppearHint: string;
  machineUsed: string;
  duration: string;
  date: string;
  completed: string;
  cancelled: string;
  loadingHistory: string;
  normal: string;
  interrupted: string;
  unauthorized: string;
  all: string;
  // Grace Period & Alarm
  graceYourTurn: string;
  graceTimeRunningOut: string;
  graceTimeRemaining: string;
  graceScanMachineNow: string;
  graceStopRinging: string;
  graceAlarmSilenced: string;
  graceCountdownContinues: string;
  graceExpiredTitle: string;
  graceExpiredBody: string;
  gracePeriod: string;
  gracePeriodActive: string;
  graceFiveMinute: string;
  graceUrgentWarning: string;
  graceMachineReady: string;
  graceHurry: string;

  // Incidents
  incidentNotYourTurn: string;
  incidentMachineReserved: string;
  incidentSecondsLeft: string;
  incidentThatsMeBtn: string;
  incidentLeaveBtn: string;
  incidentSelectReason: string;
  incidentReasonWrongQR: string;
  incidentReasonWrongQRSub: string;
  incidentReasonAccidental: string;
  incidentReasonAccidentalSub: string;
  incidentReasonTesting: string;
  incidentReasonTestingSub: string;
  incidentReasonMistake: string;
  incidentReasonMistakeSub: string;
  incidentReasonOther: string;
  incidentLeaveSubmit: string;
  incidentSelectFirst: string;
  incidentBuzzerActivated: string;
  incidentOrExplain: string;

  // Dashboard Status Card
  yourStatus: string;
  laundryInProgress: string;
  findMachine: string;
  readyToStart: string;
  viewDetails: string;
  viewAllMachines: string;
  overview: string;
  features: string;
  supportInfo: string;
  progressLabel: string;
  percentComplete: string;
  inQueueTitle: string;
  waitingForMachine: string;

  // QR Scan unauthorized flow
  machineCurrentlyInUse: string;
  machineBelongsTo: string;
  unauthorizedProceedWarning: string;
  doYouWantToProceed: string;
  leaveNow: string;
  yesIProceed: string;
  unauthorizedAccessDetected: string;
  actionsTakenIn: string;
  ownerAndAdminNotified: string;
  buzzerWillTrigger: string;

  // Admin incident
  stopBuzzer: string;
  viewRecords: string;

  // Conversations
  conversations: string;
  messages: string;
  noConversations: string;
  noConversationsYet: string;
  noResultsFound: string;
  tryDifferentSearchTerm: string;
  startConversationHint: string;
  searchMessages: string;
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
  notificationsArriveHint: string;
  deleteReadNotifications: string;
  confirmDeleteReadNotifications: string;
  earlier: string;
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
  enableOrDisableAlerts: string;
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
  privacyPolicies: string;
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
  personalInformation: string;
  securityPassword: string;
  advancedSettings: string;
  refreshNotifications: string;
  testNotification: string;
  aiAssistant: string;
  inviteFriend: string;
  guestUser: string;
  verified: string;
  unverified: string;
  success: string;
  sent: string;
  notificationsRefreshed: string;
  failedToRefreshNotifications: string;
  notificationWorking: string;
  checkNotificationTray: string;
  notificationFailed: string;
  deleteAccount: string;
  
  // Machine/IoT
  machine: string;
  machineId: string;
  machineM001: string;
  scanMachine: string;
  startMachine: string;
  stopMachine: string;
  releaseMachine: string;
  releaseMachineConfirm: string;
  yesRelease: string;
  released: string;
  failedToRelease: string;
  failedToDismissAlarm: string;
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
  locked: string;
  unlocked: string;
  buzzerActive: string;
  dismiss: string;
  controlPanel: string;
  sensorData: string;
  connectingToMachine: string;
  verifyingAccess: string;
  cameraPermissionRequired: string;
  someoneAtYourMachine: string;
  secondsRemaining: string;
  secondsToRespond: string;
  lastUpdate: string;
  unknown: string;
  
  // QR Scan
  pointCameraAtQR: string;
  flashOn: string;
  flashOff: string;
  cameraActive: string;
  positionQRCode: string;
  keepCameraSteady: string;
  scanHappensAutomatically: string;
  cancelScanning: string;
  machineReservedFor: string;
  buzzerWillSound: string;
  thatsMe: string;
  tapThatsMeIfYouAre: string;
  
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
  status: "Status",
  min: "min",
  
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
  hi: "Hi",
  user: "User",
  welcomeUser: "Welcome",
  freshAndCleanStartsHere: "Fresh & Clean starts here",
  loadingLaundrix: "Loading Laundrix...",
  quickActions: "Quick Actions",
  scanQR: "Scan QR",
  scanQRCode: "Scan QR Code",
  scanNow: "Scan Now",
  scanToStart: "Scan to Start",
  startInstantly: "Start instantly",
  howToScan: "How to scan:",
  viewHistory: "View History",
  notifications: "Notifications",
  settings: "Settings",
  activeMachines: "Active Machines",
  availableMachines: "Available Machines",
  available: "Available",
  waiting: "waiting",
  myActiveSessions: "My Active Sessions",
  noActiveSessions: "No active sessions",
  machineStatus: "Machine Status",
  minutesLeft: "min left",
  activeSession: "Active Session",
  sessions: "sessions",
  otherMachines: "Other Machines",
  primaryWasher: "Primary Washer",
  machineReady: "Machine Ready",
  readyForYourLaundry: "Ready for your laundry",
  currentlyInUse: "Currently in use",
  readyForDuty: "Ready for duty",
  washInProgress: "Wash in progress",
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
  historyWillAppearHint: "Your laundry sessions will appear here",
  machineUsed: "Machine Used",
  duration: "Duration",
  date: "Date",
  completed: "Completed",
  cancelled: "Cancelled",
  loadingHistory: "Loading history...",
  normal: "Normal",
  interrupted: "Interrupted",
  unauthorized: "Unauthorized",
  all: "All",

  // Grace Period & Alarm
  graceYourTurn: "It's Your Turn!",
  graceTimeRunningOut: "⏳ Time Is Running Out!",
  graceTimeRemaining: "Time Remaining",
  graceScanMachineNow: "Scan Machine Now",
  graceStopRinging: "Stop Ringing",
  graceAlarmSilenced: "Alarm silenced — countdown continues",
  graceCountdownContinues: "Countdown continues even after silencing.",
  graceExpiredTitle: "⏰ Grace Period Expired",
  graceExpiredBody: "You didn't scan in time. Your slot has been released.",
  gracePeriod: "Grace Period",
  gracePeriodActive: "Grace Period Active",
  graceFiveMinute: "5 minute grace period",
  graceUrgentWarning: "⚠️ Less than 1 minute left!",
  graceMachineReady: "is ready for you",
  graceHurry: "Hurry! Your slot expires soon",

  // Incidents
  incidentNotYourTurn: "Not Your Turn",
  incidentMachineReserved: "This machine is reserved for",
  incidentSecondsLeft: "seconds remaining",
  incidentThatsMeBtn: "That's Me — I'm the rightful user",
  incidentLeaveBtn: "Leave & Submit Reason",
  incidentSelectReason: "Why did you scan this machine?",
  incidentReasonWrongQR: "Scanned wrong QR",
  incidentReasonWrongQRSub: "I meant to scan a different machine",
  incidentReasonAccidental: "Accidental scan",
  incidentReasonAccidentalSub: "Didn't mean to scan at all",
  incidentReasonTesting: "Testing / exploring",
  incidentReasonTestingSub: "Just trying to see how it works",
  incidentReasonMistake: "I thought it was free",
  incidentReasonMistakeSub: "Didn't know someone had reserved it",
  incidentReasonOther: "Other reason",
  incidentLeaveSubmit: "Leave & Submit Reason",
  incidentSelectFirst: "Select a reason to leave",
  incidentBuzzerActivated: "The machine alarm has been triggered.",
  incidentOrExplain: "or explain and leave",

  // Dashboard Status Card
  yourStatus: "Your Status",
  laundryInProgress: "Laundry in Progress",
  findMachine: "Ready to Start",
  readyToStart: "Ready to Start",
  viewDetails: "View Details",
  viewAllMachines: "View All",
  overview: "Overview",
  features: "Features",
  supportInfo: "Support & Info",
  progressLabel: "Progress",
  percentComplete: "% Complete",
  inQueueTitle: "In Queue",
  waitingForMachine: "Waiting for machine",

  // QR Scan
  machineCurrentlyInUse: "Machine Currently In Use",
  machineBelongsTo: "This machine is currently used by",
  unauthorizedProceedWarning: "If you proceed, the machine owner and admin will be alerted immediately. A 60-second action window will open.",
  doYouWantToProceed: "Do you want to proceed?",
  leaveNow: "Leave Now",
  yesIProceed: "Yes, I understand — proceed",
  unauthorizedAccessDetected: "Unauthorized Access Detected",
  actionsTakenIn: "Actions will be taken in",
  ownerAndAdminNotified: "The machine owner and admin have been notified.",
  buzzerWillTrigger: "The buzzer will trigger very soon!",

  // Admin incident
  stopBuzzer: "Stop Buzzer",
  viewRecords: "View Records",

  // Conversations
  conversations: "Conversations",
  messages: "Messages",
  noConversations: "No conversations yet",
  noConversationsYet: "No conversations yet",
  noResultsFound: "No results found",
  tryDifferentSearchTerm: "Try a different search term",
  startConversationHint: "Start a new conversation by tapping the button above ✨",
  searchMessages: "Search messages...",
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
  notificationsArriveHint: "We'll let you know when something arrives ✨",
  deleteReadNotifications: "Delete Read Notifications",
  confirmDeleteReadNotifications: "Are you sure you want to delete all read notifications?",
  earlier: "Earlier",
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
  enableOrDisableAlerts: "Enable or disable all alerts",
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
  privacyPolicies: "Privacy & Policies",
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
  personalInformation: "Personal Information",
  securityPassword: "Security & Password",
  advancedSettings: "Advanced Settings",
  refreshNotifications: "Refresh Notifications",
  testNotification: "Test Notification",
  aiAssistant: "AI Assistant",
  inviteFriend: "Invite a Friend",
  guestUser: "Guest User",
  verified: "Verified",
  unverified: "Unverified",
  success: "Success",
  sent: "Sent!",
  notificationsRefreshed: "Notifications refreshed! FCM token saved.",
  failedToRefreshNotifications: "Failed to refresh notifications",
  notificationWorking: "If you see this, notifications are working!",
  checkNotificationTray: "Check your notification tray.",
  notificationFailed: "Notification failed",
  deleteAccount: "Delete Account",
  
  // Machine/IoT
  machine: "Machine",
  machineId: "Machine ID",
  machineM001: "Machine M001",
  scanMachine: "Scan Machine",
  startMachine: "Start Machine",
  stopMachine: "Stop Machine",
  releaseMachine: "Release Machine",
  releaseMachineConfirm: "Are you done with the laundry? The next person in queue will be notified.",
  yesRelease: "Yes, Release",
  released: "Released!",
  failedToRelease: "Failed to release",
  failedToDismissAlarm: "Failed to dismiss alarm",
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
  locked: "Locked",
  unlocked: "Unlocked",
  buzzerActive: "Buzzer Active",
  dismiss: "Dismiss",
  controlPanel: "Control Panel",
  sensorData: "Sensor Data",
  connectingToMachine: "Connecting to machine...",
  verifyingAccess: "Verifying access…",
  cameraPermissionRequired: "Camera permission required",
  someoneAtYourMachine: "Someone at Your Machine!",
  secondsRemaining: "seconds remaining",
  secondsToRespond: "seconds to respond",
  lastUpdate: "Last update",
  unknown: "Unknown",
  
  // QR Scan
  pointCameraAtQR: "Point camera at the machine QR",
  flashOn: "Flash On",
  flashOff: "Flash Off",
  cameraActive: "Camera active",
  positionQRCode: "Position QR code within the frame",
  keepCameraSteady: "Keep camera steady and well-lit",
  scanHappensAutomatically: "Scan happens automatically",
  cancelScanning: "Cancel Scanning",
  machineReservedFor: "This machine is reserved for",
  buzzerWillSound: "The buzzer will sound when time runs out.",
  thatsMe: "That's Me ✓",
  tapThatsMeIfYouAre: "Tap \"That's Me\" if you are",
  
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
  status: "Status",
  min: "min",
  
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
  hi: "Hai",
  user: "Pengguna",
  welcomeUser: "Selamat Datang",
  freshAndCleanStartsHere: "Kesegaran & Kebersihan bermula di sini",
  loadingLaundrix: "Memuatkan Laundrix...",
  quickActions: "Tindakan Pantas",
  scanQR: "Imbas QR",
  scanQRCode: "Imbas Kod QR",
  scanNow: "Imbas Sekarang",
  scanToStart: "Imbas untuk Mula",
  startInstantly: "Mula serta-merta",
  howToScan: "Cara mengimbas:",
  viewHistory: "Lihat Sejarah",
  notifications: "Pemberitahuan",
  settings: "Tetapan",
  activeMachines: "Mesin Aktif",
  availableMachines: "Mesin Tersedia",
  available: "Tersedia",
  waiting: "menunggu",
  myActiveSessions: "Sesi Aktif Saya",
  noActiveSessions: "Tiada sesi aktif",
  machineStatus: "Status Mesin",
  activeSession: "Sesi Aktif",
  sessions: "sesi",
  otherMachines: "Mesin Lain",
  primaryWasher: "Mesin Basuh Utama",
  machineReady: "Mesin Sedia",
  readyForYourLaundry: "Sedia untuk cucian anda",
  currentlyInUse: "Sedang digunakan",
  readyForDuty: "Sedia untuk bertugas",
  washInProgress: "Pencucian sedang berjalan",
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
  historyWillAppearHint: "Sesi cucian anda akan dipaparkan di sini",
  machineUsed: "Mesin Digunakan",
  duration: "Tempoh",
  date: "Tarikh",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  loadingHistory: "Memuatkan sejarah...",
  normal: "Normal",
  interrupted: "Terganggu",
  unauthorized: "Tidak Sah",
  all: "Semua",

  // Grace Period & Alarm
  graceYourTurn: "Giliran Anda!",
  graceTimeRunningOut: "⏳ Masa Hampir Tamat!",
  graceTimeRemaining: "Masa Tinggal",
  graceScanMachineNow: "Imbas Mesin Sekarang",
  graceStopRinging: "Hentikan Loceng",
  graceAlarmSilenced: "Loceng dihentikan — kiraan berterusan",
  graceCountdownContinues: "Kiraan berterusan walaupun loceng dihentikan.",
  graceExpiredTitle: "⏰ Tempoh Tangguh Tamat",
  graceExpiredBody: "Anda tidak mengimbas dalam masa. Slot anda telah dilepaskan.",
  gracePeriod: "Tempoh Tangguh",
  gracePeriodActive: "Tempoh Tangguh Aktif",
  graceFiveMinute: "Tempoh tangguh 5 minit",
  graceUrgentWarning: "⚠️ Kurang dari 1 minit lagi!",
  graceMachineReady: "sudah sedia untuk anda",
  graceHurry: "Cepat! Slot anda akan tamat tidak lama lagi",

  // Incidents
  incidentNotYourTurn: "Bukan Giliran Anda",
  incidentMachineReserved: "Mesin ini ditempah untuk",
  incidentSecondsLeft: "saat berbaki",
  incidentThatsMeBtn: "Itu Saya — Saya pengguna yang sah",
  incidentLeaveBtn: "Tinggalkan & Hantar Sebab",
  incidentSelectReason: "Kenapa anda mengimbas mesin ini?",
  incidentReasonWrongQR: "Imbas QR salah",
  incidentReasonWrongQRSub: "Saya bermaksud mengimbas mesin lain",
  incidentReasonAccidental: "Imbasan tidak sengaja",
  incidentReasonAccidentalSub: "Tidak berniat mengimbas sama sekali",
  incidentReasonTesting: "Ujian / penerokaan",
  incidentReasonTestingSub: "Hanya ingin tahu cara ia berfungsi",
  incidentReasonMistake: "Saya fikir ia percuma",
  incidentReasonMistakeSub: "Tidak tahu seseorang sudah menempahnya",
  incidentReasonOther: "Sebab lain",
  incidentLeaveSubmit: "Tinggalkan & Hantar Sebab",
  incidentSelectFirst: "Pilih sebab untuk meninggalkan",
  incidentBuzzerActivated: "Penggera mesin telah diaktifkan.",
  incidentOrExplain: "atau terangkan dan tinggalkan",

  // Dashboard Status Card
  yourStatus: "Status Anda",
  laundryInProgress: "Cucian Sedang Berjalan",
  findMachine: "Sedia Bermula",
  readyToStart: "Sedia Bermula",
  viewDetails: "Lihat Butiran",
  viewAllMachines: "Lihat Semua",
  overview: "Gambaran Keseluruhan",
  features: "Ciri-ciri",
  supportInfo: "Sokongan & Maklumat",
  progressLabel: "Kemajuan",
  percentComplete: "% Selesai",
  inQueueTitle: "Dalam Barisan",
  waitingForMachine: "Menunggu mesin",

  // QR Scan
  machineCurrentlyInUse: "Mesin Sedang Digunakan",
  machineBelongsTo: "Mesin ini sedang digunakan oleh",
  unauthorizedProceedWarning: "Jika anda meneruskan, pemilik mesin dan pentadbir akan diberitahu serta-merta. Tetingkap tindakan 60 saat akan dibuka.",
  doYouWantToProceed: "Adakah anda ingin meneruskan?",
  leaveNow: "Tinggalkan Sekarang",
  yesIProceed: "Ya, saya faham — teruskan",
  unauthorizedAccessDetected: "Akses Tidak Sah Dikesan",
  actionsTakenIn: "Tindakan akan diambil dalam",
  ownerAndAdminNotified: "Pemilik mesin dan pentadbir telah diberitahu.",
  buzzerWillTrigger: "Penggera akan dibunyikan tidak lama lagi!",

  // Admin incident
  stopBuzzer: "Hentikan Penggera",
  viewRecords: "Lihat Rekod",

  // Conversations
  conversations: "Perbualan",
  messages: "Mesej",
  noConversations: "Tiada perbualan lagi",
  noConversationsYet: "Tiada perbualan lagi",
  noResultsFound: "Tiada hasil ditemui",
  tryDifferentSearchTerm: "Cuba istilah carian lain",
  startConversationHint: "Mulakan perbualan baru dengan menekan butang di atas ✨",
  searchMessages: "Cari mesej...",
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
  notificationsArriveHint: "Kami akan maklumkan anda apabila ada perkara baru ✨",
  deleteReadNotifications: "Padam Pemberitahuan Dibaca",
  confirmDeleteReadNotifications: "Adakah anda pasti mahu memadam semua pemberitahuan yang telah dibaca?",
  earlier: "Sebelum Ini",
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
  enableOrDisableAlerts: "Aktif atau nyahaktif semua amaran",
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
  privacyPolicies: "Privasi & Polisi",
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
  personalInformation: "Maklumat Peribadi",
  securityPassword: "Keselamatan & Kata Laluan",
  advancedSettings: "Tetapan Lanjutan",
  refreshNotifications: "Muat Semula Pemberitahuan",
  testNotification: "Uji Pemberitahuan",
  aiAssistant: "Pembantu AI",
  inviteFriend: "Jemput Rakan",
  guestUser: "Pengguna Tetamu",
  verified: "Disahkan",
  unverified: "Belum Disahkan",
  success: "Berjaya",
  sent: "Dihantar!",
  notificationsRefreshed: "Pemberitahuan dimuat semula! Token FCM disimpan.",
  failedToRefreshNotifications: "Gagal memuat semula pemberitahuan",
  notificationWorking: "Jika anda melihat ini, pemberitahuan berfungsi!",
  checkNotificationTray: "Semak tray pemberitahuan anda.",
  notificationFailed: "Pemberitahuan gagal",
  deleteAccount: "Padam Akaun",
  
  // Machine/IoT
  machine: "Mesin",
  machineId: "ID Mesin",
  machineM001: "Mesin M001",
  scanMachine: "Imbas Mesin",
  startMachine: "Mulakan Mesin",
  stopMachine: "Hentikan Mesin",
  releaseMachine: "Lepaskan Mesin",
  releaseMachineConfirm: "Sudah selesai dengan dobi? Orang seterusnya dalam barisan akan diberitahu.",
  yesRelease: "Ya, Lepaskan",
  released: "Dilepaskan!",
  failedToRelease: "Gagal melepaskan",
  failedToDismissAlarm: "Gagal mematikan penggera",
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
  locked: "Berkunci",
  unlocked: "Tidak Berkunci",
  buzzerActive: "Buzzer Aktif",
  dismiss: "Matikan",
  controlPanel: "Panel Kawalan",
  sensorData: "Data Sensor",
  connectingToMachine: "Menyambung ke mesin...",
  verifyingAccess: "Mengesahkan akses…",
  cameraPermissionRequired: "Kebenaran kamera diperlukan",
  someoneAtYourMachine: "Seseorang di Mesin Anda!",
  secondsRemaining: "saat berbaki",
  secondsToRespond: "saat untuk menjawab",
  lastUpdate: "Kemas kini terakhir",
  unknown: "Tidak diketahui",
  minutesLeft: "Minit ditinggalkan",  // or "minutes remaining"
  
  // QR Scan
  pointCameraAtQR: "Halakan kamera ke kod QR mesin",
  flashOn: "Denyar Hidup",
  flashOff: "Denyar Mati",
  cameraActive: "Kamera aktif",
  positionQRCode: "Letak kod QR dalam bingkai",
  keepCameraSteady: "Pastikan kamera stabil dan terang",
  scanHappensAutomatically: "Imbasan berlaku secara automatik",
  cancelScanning: "Batal Imbasan",
  machineReservedFor: "Mesin ini ditempah untuk",
  buzzerWillSound: "Buzzer akan berbunyi apabila masa tamat.",
  thatsMe: "Itu Saya ✓",
  tapThatsMeIfYouAre: "Tekan \"Itu Saya\" jika anda adalah",
  
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