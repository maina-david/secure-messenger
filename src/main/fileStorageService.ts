import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

export class FileStorageService {
  private storageDir: string;
  private thumbnailDir: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storageDir = path.join(userDataPath, 'media');
    this.thumbnailDir = path.join(userDataPath, 'media', 'thumbnails');

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailDir)) {
      fs.mkdirSync(this.thumbnailDir, { recursive: true });
    }
  }

  /**
   * Save a file to the storage directory
   * @param buffer File data
   * @param originalName Original filename
   * @param subDir Optional subdirectory (e.g., 'images', 'files')
   * @returns Relative path to the saved file
   */
  async saveFile(buffer: Buffer, originalName: string, subDir?: string): Promise<string> {
    // Generate unique filename
    const ext = path.extname(originalName);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
    const timestamp = Date.now();
    const fileName = `${timestamp}_${hash}${ext}`;

    // Determine full path
    const targetDir = subDir ? path.join(this.storageDir, subDir) : this.storageDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, fileName);

    // Write file
    await fs.promises.writeFile(filePath, buffer);

    // Return relative path from storage directory
    return subDir ? path.join(subDir, fileName) : fileName;
  }

  /**
   * Get the full path to a file
   * @param relativePath Relative path from storage directory
   * @returns Full filesystem path
   */
  getFullPath(relativePath: string): string {
    return path.join(this.storageDir, relativePath);
  }

  /**
   * Read a file from storage
   * @param relativePath Relative path from storage directory
   * @returns File buffer
   */
  async getFile(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(relativePath);
    return await fs.promises.readFile(fullPath);
  }

  /**
   * Delete a file from storage
   * @param relativePath Relative path from storage directory
   * @returns Success boolean
   */
  async deleteFile(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(relativePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Check if a file exists
   * @param relativePath Relative path from storage directory
   * @returns Existence boolean
   */
  fileExists(relativePath: string): boolean {
    const fullPath = this.getFullPath(relativePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get file size
   * @param relativePath Relative path from storage directory
   * @returns File size in bytes
   */
  async getFileSize(relativePath: string): Promise<number> {
    const fullPath = this.getFullPath(relativePath);
    const stats = await fs.promises.stat(fullPath);
    return stats.size;
  }

  /**
   * Save an image with optional thumbnail generation
   * For now, just saves the image. Thumbnail generation would require image processing library.
   */
  async saveImage(buffer: Buffer, originalName: string): Promise<{ path: string; thumbnail?: string }> {
    const imagePath = await this.saveFile(buffer, originalName, 'images');

    return {
      path: imagePath,
      thumbnail: undefined
    };
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Get thumbnail directory path
   */
  getThumbnailDir(): string {
    return this.thumbnailDir;
  }
}
