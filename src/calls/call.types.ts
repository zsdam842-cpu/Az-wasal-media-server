export type CallType =
  | "audio"
  | "video";

export type CallStatus =
  | "ringing"
  | "accepted"
  | "rejected"
  | "ended"
  | "missed";

export interface CallSession {
  callId: string;
  callerId: string;
  receiverId: string;
  type: CallType;
  status: CallStatus;
  createdAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
}

export interface CallOffer {
  callId: string;
  callerId: string;
  receiverId: string;
  type: CallType;
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswer {
  callId: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidate {
  callId: string;
  candidate: RTCIceCandidateInit;
}
