import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Heart, Trash2, MessageSquare, Upload, X, Play, Pause, Image, Video } from 'lucide-react';
import { 
  listPhotos, 
  likePhotoRemote, 
  addPhotoCommentRemote, 
  type FamilyPhoto, 
  subscribeToPhotoUpdates 
} from '@/lib/photoService';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useUserHousehold } from '@/hooks/useUserHousehold';
import { MediaUploadWidget } from '@/components/MediaUploadWidget';
import RelativeNavigation from '@/components/RelativeNavigation';

const FamilyMemories: React.FC = () => {
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [mediaUploads, setMediaUploads] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  const { getMediaUploads, getSignedUrl, deleteMedia } = useMediaUpload();
  const { household } = useUserHousehold();

  useEffect(() => {
    let unsub = () => {};
    const loadData = async () => {
      if (!household?.id) return;
      
      try {
        // Load both old photos and new media uploads
        const [photosList, mediaList] = await Promise.all([
          listPhotos(),
          getMediaUploads(household.id)
        ]);
        
        setPhotos(photosList);
        setMediaUploads(mediaList);
      } catch (error) {
        console.error('Error loading media:', error);
        toast.error('Failed to load family media');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    try {
      unsub = subscribeToPhotoUpdates(loadData);
    } catch (error) {
      console.error('Error subscribing to photo updates:', error);
    }
    
    return () => unsub();
  }, [household?.id]);

  const handleUploadSuccess = async () => {
    if (!household?.id) return;
    
    // Reload both photos and media uploads
    try {
      const [photosList, mediaList] = await Promise.all([
        listPhotos(),
        getMediaUploads(household.id)
      ]);
      
      setPhotos(photosList);
      setMediaUploads(mediaList);
      setShowUpload(false);
    } catch (error) {
      console.error('Error reloading media:', error);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    const success = await deleteMedia(mediaId);
    if (success && household?.id) {
      const mediaList = await getMediaUploads(household.id);
      setMediaUploads(mediaList);
    }
  };

  const likePhoto = async (id: string) => {
    try {
      await likePhotoRemote(id);
      const list = await listPhotos();
      setPhotos(list);
    } catch (error) {
      console.error('Error liking photo:', error);
      toast.error('Failed to like photo');
    }
  };

  const removePhoto = async (id: string) => {
    try {
      // For legacy photos, just remove from local state for now
      setPhotos(prev => prev.filter(p => p.id !== id));
      toast.success('Photo removed');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Failed to remove photo');
    }
  };

  const addComment = async (photoId: string) => {
    const text = commentInputs[photoId];
    if (!text || !text.trim()) {
      return;
    }

    try {
      await addPhotoCommentRemote(photoId, { 
        author: 'Family Member', 
        text: text.trim() 
      });
      setCommentInputs({ ...commentInputs, [photoId]: '' });
      const list = await listPhotos();
      setPhotos(list);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const MediaItem = ({ item, type }: { item: any; type: 'photo' | 'media' }) => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
      if (type === 'media' && item.mime_type?.startsWith('video/')) {
        getSignedUrl(item.mime_type.startsWith('image/') ? 'family-photos' : 'family-media', item.storage_path)
          .then(setVideoUrl);
      }
    }, [item]);

    const mediaUrl = type === 'photo' ? item.url : 
      item.mime_type?.startsWith('image/') ? item.url : videoUrl;

    return (
      <Card key={item.id} className="overflow-hidden">
        <div className="relative">
          {item.mime_type?.startsWith('video/') ? (
            <div className="relative">
              <video
                src={videoUrl || ''}
                className="w-full h-64 md:h-80 object-cover"
                controls={isPlaying}
                poster={item.thumbnail_url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => setIsPlaying(true)}
                  >
                    <Play className="h-8 w-8" />
                  </Button>
                </div>
              )}
              <Badge className="absolute top-2 left-2" variant="secondary">
                <Video className="h-3 w-3 mr-1" />
                Video
              </Badge>
            </div>
          ) : (
            <div className="relative">
              <img
                src={mediaUrl || '/placeholder.svg'}
                alt={item.alt || item.caption || 'Family memory'}
                className="w-full h-64 md:h-80 object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              <Badge className="absolute top-2 left-2" variant="secondary">
                <Image className="h-3 w-3 mr-1" />
                Photo
              </Badge>
            </div>
          )}
          
          <div className="absolute top-4 right-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => type === 'photo' ? removePhoto(item.id) : handleDeleteMedia(item.id)}
              className="opacity-80 hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <CardContent className="p-4 space-y-4">
          {/* Caption */}
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {item.caption || item.original_filename}
            </h3>
            <p className="text-sm text-muted-foreground">
              Shared by {item.uploadedBy || item.uploaded_by || 'Family Member'} • {' '}
              {new Date(item.uploadedAt || item.created_at).toLocaleDateString()}
            </p>
            {type === 'media' && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.file_size && `${(item.file_size / 1024 / 1024).toFixed(1)} MB`}
                {item.delivery_status && (
                  <Badge 
                    variant={item.delivery_status === 'delivered' ? 'default' : 'secondary'} 
                    className="ml-2"
                  >
                    {item.delivery_status}
                  </Badge>
                )}
              </p>
            )}
          </div>

          {/* Like and Comment Actions (only for photos for now) */}
          {type === 'photo' && (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => likePhoto(item.id)}
                  className="flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  {item.likes ?? 0}
                </Button>
                
                <div className="flex items-center gap-2 flex-1 ml-4">
                  <Input
                    placeholder="Add a loving comment..."
                    value={commentInputs[item.id] ?? ''}
                    onChange={(e) => setCommentInputs({ 
                      ...commentInputs, 
                      [item.id]: e.target.value 
                    })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addComment(item.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => addComment(item.id)}
                    disabled={!commentInputs[item.id]?.trim()}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Comments */}
              {item.comments && item.comments.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  {item.comments.slice(-3).map((comment: any) => (
                    <div key={comment.id} className="text-sm">
                      <span className="font-medium text-foreground">{comment.author}:</span>
                      <span className="text-muted-foreground ml-2">{comment.text}</span>
                    </div>
                  ))}
                  {item.comments.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      And {item.comments.length - 3} more comments...
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <RelativeNavigation />
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Family Memories</h1>
          <p className="text-muted-foreground">Share precious moments with your loved ones</p>
        </div>

        {/* Upload Section */}
        {showUpload && household?.id && (
          <MediaUploadWidget
            householdId={household.id}
            onUploadSuccess={handleUploadSuccess}
            className="mb-6"
          />
        )}

        {!showUpload && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Camera className="w-5 h-5" />
                Share Family Moments
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload photos and videos to share with your loved ones
              </p>
              <Button
                onClick={() => setShowUpload(true)}
                className="mt-4"
                disabled={!household?.id}
              >
                <Upload className="w-4 h-4 mr-2" />
                Share Media
              </Button>
            </CardHeader>
          </Card>
        )}

        {/* Media Gallery */}
        {photos.length === 0 && mediaUploads.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Camera className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No memories shared yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building your family memory collection by uploading your first photo or video
              </p>
              <Button onClick={() => setShowUpload(true)} disabled={!household?.id}>
                <Upload className="w-4 h-4 mr-2" />
                Share First Memory
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* New Media Uploads */}
            {mediaUploads.map((media) => (
              <MediaItem key={`media-${media.id}`} item={media} type="media" />
            ))}
            
            {/* Legacy Photos */}
            {photos.map((photo) => (
              <MediaItem key={`photo-${photo.id}`} item={photo} type="photo" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyMemories;