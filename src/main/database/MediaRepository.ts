import { BaseRepository } from './BaseRepository';

export interface MediaAttachment {
  id: number;
  messageId: number;
  type: 'image' | 'file' | 'voice' | 'video';
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  thumbnailPath?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedAt: number;
}

export interface AddMediaAttachmentOptions {
  thumbnailPath?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export class MediaRepository extends BaseRepository {
  /**
   * Add a media attachment to a message
   */
  addMediaAttachment(
    messageId: number,
    type: 'image' | 'file' | 'voice' | 'video',
    fileName: string,
    fileSize: number,
    mimeType: string,
    filePath: string,
    options?: AddMediaAttachmentOptions
  ): number {
    return this.insert('media_attachments', {
      messageId,
      type,
      fileName,
      fileSize,
      mimeType,
      filePath,
      thumbnailPath: options?.thumbnailPath || null,
      duration: options?.duration || null,
      width: options?.width || null,
      height: options?.height || null,
      uploadedAt: Date.now()
    });
  }

  /**
   * Get all media attachments for a message
   */
  getMediaAttachments(messageId: number): MediaAttachment[] {
    const stmt = this.prepare(`
      SELECT id, messageId, type, fileName, fileSize, mimeType, filePath,
             thumbnailPath, duration, width, height, uploadedAt
      FROM media_attachments
      WHERE messageId = ?
      ORDER BY uploadedAt ASC
    `);
    return stmt.all(messageId) as MediaAttachment[];
  }

  /**
   * Get media attachments for a chat, optionally filtered by type
   */
  getMediaAttachmentsByChat(chatId: number, type?: 'image' | 'file' | 'voice' | 'video'): MediaAttachment[] {
    let sql = `
      SELECT ma.id, ma.messageId, ma.type, ma.fileName, ma.fileSize, ma.mimeType, ma.filePath,
             ma.thumbnailPath, ma.duration, ma.width, ma.height, ma.uploadedAt
      FROM media_attachments ma
      INNER JOIN messages m ON ma.messageId = m.id
      WHERE m.chatId = ?
    `;
    const params: any[] = [chatId];

    if (type) {
      sql += ' AND ma.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY ma.uploadedAt DESC';

    const stmt = this.prepare(sql);
    return stmt.all(...params) as MediaAttachment[];
  }

  /**
   * Get a media attachment by ID
   */
  getMediaAttachmentById(id: number): MediaAttachment | undefined {
    const stmt = this.prepare(`
      SELECT id, messageId, type, fileName, fileSize, mimeType, filePath,
             thumbnailPath, duration, width, height, uploadedAt
      FROM media_attachments
      WHERE id = ?
    `);
    return stmt.get(id) as MediaAttachment | undefined;
  }

  /**
   * Delete a media attachment
   */
  deleteMediaAttachment(id: number): boolean {
    const changes = this.delete('media_attachments', 'id = ?', id);
    return changes > 0;
  }
}
