import { BaseService } from './BaseService';
import { MediaRepository, MediaAttachment, AddMediaAttachmentOptions } from '../database/MediaRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class MediaService extends BaseService {
  private mediaRepo: MediaRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.mediaRepo = new MediaRepository(dbConnection);
  }

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
    this.validateRequired(
      { messageId, type, fileName, fileSize, mimeType, filePath },
      ['messageId', 'type', 'fileName', 'fileSize', 'mimeType', 'filePath']
    );

    if (fileSize <= 0) {
      throw new Error('File size must be greater than 0');
    }

    return this.mediaRepo.addMediaAttachment(
      messageId,
      type,
      fileName,
      fileSize,
      mimeType,
      filePath,
      options
    );
  }

  /**
   * Get all media attachments for a message
   */
  getMediaAttachments(messageId: number): MediaAttachment[] {
    return this.mediaRepo.getMediaAttachments(messageId);
  }

  /**
   * Get media attachments for a chat, optionally filtered by type
   */
  getMediaAttachmentsByChat(chatId: number, type?: 'image' | 'file' | 'voice' | 'video'): MediaAttachment[] {
    return this.mediaRepo.getMediaAttachmentsByChat(chatId, type);
  }

  /**
   * Get a media attachment by ID
   */
  getMediaAttachmentById(id: number): MediaAttachment | null {
    return this.mediaRepo.getMediaAttachmentById(id) || null;
  }

  /**
   * Delete a media attachment
   */
  deleteMediaAttachment(id: number): boolean {
    return this.mediaRepo.deleteMediaAttachment(id);
  }
}
