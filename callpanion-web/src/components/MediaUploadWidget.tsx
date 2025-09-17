import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Upload, X, Image, Video } from 'lucide-react';
import { toast } from 'sonner';

interface MediaUploadWidgetProps {
  householdId: string;
  onUploadSuccess?: () => void;
  className?: string;
}

export const MediaUploadWidget: React.FC<MediaUploadWidgetProps> = ({
  householdId,
  onUploadSuccess,
  className = ''
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, isUploading, uploadProgress } = useMediaUpload();

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/x-msvideo'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported. Please upload images or videos.');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    const result = await uploadFile(selectedFile, householdId, caption);
    
    if (result.success) {
      setSelectedFile(null);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess?.();
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Share Family Media
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/10' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <div>
                <p className="text-lg font-medium">
                  Drag & drop your photos or videos here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse files
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
              >
                Browse Files
              </Button>
              <p className="text-xs text-muted-foreground">
                Supports: JPG, PNG, GIF, MP4, MOV, AVI • Max size: 50MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-shrink-0">
                {selectedFile.type.startsWith('image/') ? (
                  <Image className="h-8 w-8 text-blue-500" />
                ) : (
                  <Video className="h-8 w-8 text-purple-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="caption" className="text-sm font-medium">
                Caption (optional)
              </label>
              <Textarea
                id="caption"
                placeholder="Add a caption for your family..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={isUploading}
                rows={3}
              />
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : 'Share with Family'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileInputChange}
        />
      </CardContent>
    </Card>
  );
};