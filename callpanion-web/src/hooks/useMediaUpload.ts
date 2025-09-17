import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UploadResult {
  success: boolean;
  media_id?: string;
  storage_path?: string;
  bucket?: string;
  error?: string;
}

interface MediaUpload {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  upload_status: string;
  delivery_status: string;
  delivered_to: any; // JSON array from Supabase
  created_at: string;
  uploaded_by: string;
}

export const useMediaUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();

  const uploadFile = async (
    file: File, 
    householdId: string, 
    caption?: string
  ): Promise<UploadResult> => {
    if (!user) {
      toast.error('Please log in to upload files');
      return { success: false, error: 'Not authenticated' };
    }

    if (!file) {
      toast.error('Please select a file to upload');
      return { success: false, error: 'No file provided' };
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB.');
      return { success: false, error: 'File too large' };
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/x-msvideo'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported. Please upload images or videos.');
      return { success: false, error: 'Invalid file type' };
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('household_id', householdId);
      if (caption) {
        formData.append('caption', caption);
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      // Upload via edge function
      const { data, error } = await supabase.functions.invoke('upload-media', {
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      setUploadProgress(100);
      toast.success('File uploaded successfully!');
      
      return {
        success: true,
        media_id: data.media_id,
        storage_path: data.storage_path,
        bucket: data.bucket
      };

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(`Upload failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getMediaUploads = async (householdId: string): Promise<MediaUpload[]> => {
    try {
      const { data, error } = await supabase
        .from('media_uploads')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching media uploads:', error);
      toast.error('Failed to load media uploads');
      return [];
    }
  };

  const getSignedUrl = async (bucket: string, path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) {
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };

  const deleteMedia = async (mediaId: string) => {
    try {
      // Get media record first
      const { data: media, error: fetchError } = await supabase
        .from('media_uploads')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (fetchError || !media) {
        throw new Error('Media not found');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(media.mime_type.startsWith('image/') ? 'family-photos' : 'family-media')
        .remove([media.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('media_uploads')
        .delete()
        .eq('id', mediaId);

      if (dbError) {
        throw dbError;
      }

      // Also delete from family_photos if it's an image
      if (media.mime_type.startsWith('image/')) {
        await supabase
          .from('family_photos')
          .delete()
          .eq('storage_path', media.storage_path);
      }

      toast.success('Media deleted successfully');
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete media');
      return false;
    }
  };

  return {
    uploadFile,
    getMediaUploads,
    getSignedUrl,
    deleteMedia,
    isUploading,
    uploadProgress
  };
};