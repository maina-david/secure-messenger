import { BaseService } from './BaseService';
import { CallRepository, Call, CallParticipant } from '../database/CallRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';
import * as crypto from 'crypto';

export class CallService extends BaseService {
  private callRepo: CallRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.callRepo = new CallRepository(dbConnection);
  }

  /**
   * Create a new call
   */
  createCall(chatId: number, type: 'audio' | 'video', initiatedBy: string): string {
    this.validateRequired({ chatId, type, initiatedBy }, ['chatId', 'type', 'initiatedBy']);

    const callId = crypto.randomUUID();
    return this.callRepo.createCall(callId, chatId, type, initiatedBy);
  }

  /**
   * Get a call by ID
   */
  getCall(callId: string): Call | null {
    return this.callRepo.getCall(callId);
  }

  /**
   * Get calls for a chat
   */
  getCallsByChat(chatId: number, limit: number = 50): Call[] {
    return this.callRepo.getCallsByChat(chatId, limit);
  }

  /**
   * Get the active call for a chat
   */
  getActiveCall(chatId: number): Call | null {
    return this.callRepo.getActiveCall(chatId);
  }

  /**
   * Update call status
   */
  updateCallStatus(callId: string, status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'): boolean {
    return this.callRepo.updateCallStatus(callId, status);
  }

  /**
   * Answer a call
   */
  answerCall(callId: string, userId: string): boolean {
    this.validateRequired({ callId, userId }, ['callId', 'userId']);
    return this.callRepo.answerCall(callId, userId);
  }

  /**
   * Decline a call
   */
  declineCall(callId: string): boolean {
    return this.callRepo.declineCall(callId);
  }

  /**
   * End a call
   */
  endCall(callId: string): boolean {
    return this.callRepo.endCall(callId);
  }

  /**
   * Add a participant to a call
   */
  addCallParticipant(callId: string, userId: string): number {
    this.validateRequired({ callId, userId }, ['callId', 'userId']);
    return this.callRepo.addCallParticipant(callId, userId);
  }

  /**
   * Remove a participant from a call
   */
  removeCallParticipant(callId: string, userId: string): boolean {
    return this.callRepo.removeCallParticipant(callId, userId);
  }

  /**
   * Get all participants for a call
   */
  getCallParticipants(callId: string): CallParticipant[] {
    return this.callRepo.getCallParticipants(callId);
  }

  /**
   * Get active participants for a call
   */
  getActiveCallParticipants(callId: string): CallParticipant[] {
    return this.callRepo.getActiveCallParticipants(callId);
  }
}
