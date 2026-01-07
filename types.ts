
export enum Language {
  EN = 'en',
  BM = 'bm',
  BC = 'bc',
  BI = 'bi'
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  points: number;
  phone?: string;
  address?: string;
  birthdate?: string;
  age?: number;
  isAdmin?: boolean;
  settings: {
    autoShareContact: boolean;
    receiveNotifications: boolean;
    shareLocation: boolean;
    profileVisibility: string;
  };
}

export interface HelpRequest {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  name: string;
  address: string;
  age: number | string;
  phone: string;
  category: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  pickupPoint: string;
  status: 'pending' | 'fulfilled' | 'completed';
  createdAt: any;
  fulfilledBy?: string;
  fulfilledByName?: string;
  fulfilledAt?: any;
  completedAt?: any;
  points: number;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  // Fix: added optional isAdmin to ChatMessage to support message categorization in help center and admin panel
  isAdmin?: boolean;
}

export interface ChatRoom {
  id: string;
  requestId: string;
  requestCategory: string;
  // Added requestName to hold the descriptive title of the request for the chat UI
  requestName?: string;
  // Added lastSenderId to track who sent the most recent message for read/unread status simulation
  lastSenderId?: string;
  participants: string[];
  participantNames: string[];
  lastMessage?: string;
  updatedAt: any;
}