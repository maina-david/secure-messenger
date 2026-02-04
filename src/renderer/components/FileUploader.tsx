import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onUploadComplete: (attachment: {
    filePath: string;
    fileName: string;
    fileSize: number;
    type: 'image' | 'file' | 'voice' | 'video';
    mimeType: string;
  }) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadComplete,
  maxSizeMB = 50,
  acceptedTypes,
  className,
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (mimeType: string): 'image' | 'file' | 'voice' | 'video' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'voice';
    return 'file';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (mimeType.startsWith('video/')) return <Video className="h-5 w-5" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    // Check file type if restrictions exist
    if (acceptedTypes && acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some((type) => {
        if (type.endsWith('/*')) {
          const prefix = type.slice(0, -2);
          return file.type.startsWith(prefix);
        }
        return file.type === type;
      });

      if (!isAccepted) {
        return 'File type not supported';
      }
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Add to uploading list
    const newFile: UploadingFile = { file, progress: 0 };
    setUploadingFiles((prev) => [...prev, newFile]);

    try {
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Simulate progress (in real implementation, track upload progress)
      const updateProgress = (progress: number) => {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.file === file ? { ...f, progress } : f))
        );
      };

      updateProgress(30);

      // Upload file
      const response = await window.electronAPI.uploadFile({
        buffer: arrayBuffer,
        fileName: file.name,
        mimeType: file.type,
      });

      updateProgress(100);

      if (response.success && response.data) {
        onUploadComplete({
          ...response.data,
          fileName: file.name,
          mimeType: file.type,
        });
        toast.success(`File "${file.name}" uploaded successfully`);

        // Remove from uploading list after a delay
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
        }, 1000);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload "${file.name}"`);
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        )
      );
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      uploadFile(file);
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        )}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          accept={acceptedTypes?.join(',')}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: {maxSizeMB}MB
            </p>
          </div>
        </div>
      </div>

      {/* Uploading Files List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadFile) => (
            <div
              key={uploadFile.file.name + uploadFile.file.lastModified}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              <div className="text-muted-foreground">
                {getFileIcon(uploadFile.file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">
                    {uploadFile.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatFileSize(uploadFile.file.size)}
                  </span>
                </div>
                {!uploadFile.error ? (
                  <Progress value={uploadFile.progress} className="h-1" />
                ) : (
                  <p className="text-xs text-destructive">{uploadFile.error}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(uploadFile.file);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
