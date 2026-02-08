import { BaseRepository } from './BaseRepository';

export interface Call {
  id: string;
  chatId: number;
  type: 'audio' | 'video';
  initiatedBy: string;
  startedAt: number;
  endedAt?: number | null;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
}

export interface CallParticipant {
  id: number;
  callId: string;
  userId: string;
  joinedAt?: number | null;
  leftAt?: number | null;
}

export class CallRepository extends BaseRepository {
  /**
   * Create a new call
   */
  createCall(id: string, chatId: number, type: 'audio' | 'video', initiatedBy: string): string {
    this.insert('calls', {
      id,
      chatId,
      type,
      initiatedBy,
      startedAt: Date.now(),
      status: 'ringing'
    });
    return id;
  }

  /**
   * Get a call by ID
   */
  getCall(callId: string): Call | null {
    const stmt = this.prepare('SELECT * FROM calls WHERE id = ?');
    return (stmt.get(callId) as Call | undefined) || null;
  }

  /**
   * Get calls for a chat
   */
  getCallsByChat(chatId: number, limit: number = 50): Call[] {
    const stmt = this.prepare(`
      SELECT * FROM calls
      WHERE chatId = ?
      ORDER BY startedAt DESC
      LIMIT ?
    `);
    return stmt.all(chatId, limit) as Call[];
  }

  /**
   * Get the active call for a chat
   */
  getActiveCall(chatId: number): Call | null {
    const stmt = this.prepare(`
      SELECT * FROM calls
      WHERE chatId = ? AND status IN ('ringing', 'active')
      ORDER BY startedAt DESC
      LIMIT 1
    `);
    return (stmt.get(chatId) as Call | undefined) || null;
  }

  /**
   * Update call status
   */
  updateCallStatus(callId: string, status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'): boolean {
    const changes = this.update('calls', { status }, 'id = ?', callId);
    return changes > 0;
  }

  /**
   * Answer a call (set status to active)
   */
  answerCall(callId: string, userId: string): boolean {
    try {
      return this.transaction(() => {
        // Update call status to active
        const updated = this.update('calls', { status: 'active' }, 'id = ?', callId);
        if (updated === 0) return false;

        // Add participant
        this.addCallParticipant(callId, userId);
        return true;
      });
    } catch (error) {
      console.error('[CallRepository] Error answering call:', error);
      return false;
    }
  }

  /**
   * Decline a call
   */
  declineCall(callId: string): boolean {
    const changes = this.update(
      'calls',
      { status: 'declined', endedAt: Date.now() },
      'id = ?',
      callId
    );
    return changes > 0;
  }

  /**
   * End a call
   */
  endCall(callId: string): boolean {
    const changes = this.update(
      'calls',
      { status: 'ended', endedAt: Date.now() },
      'id = ?',
      callId
    );
    return changes > 0;
  }

  /**
   * Add a participant to a call
   */
  addCallParticipant(callId: string, userId: string): number {
    return this.insert('call_participants', {
      callId,
      userId,
      joinedAt: Date.now()
    });
  }

  /**
   * Remove a participant from a call
   */
  removeCallParticipant(callId: string, userId: string): boolean {
    const changes = this.update(
      'call_participants',
      { leftAt: Date.now() },
      'callId = ? AND userId = ? AND leftAt IS NULL',
      callId,
      userId
    );
    return changes > 0;
  }

  /**
   * Get all participants for a call
   */
  getCallParticipants(callId: string): CallParticipant[] {
    const stmt = this.prepare('SELECT * FROM call_participants WHERE callId = ?');
    return stmt.all(callId) as CallParticipant[];
  }

  /**
   * Get active participants for a call
   */
  getActiveCallParticipants(callId: string): CallParticipant[] {
    const stmt = this.prepare(`
      SELECT * FROM call_participants
      WHERE callId = ? AND leftAt IS NULL
    `);
    return stmt.all(callId) as CallParticipant[];
  }
}
