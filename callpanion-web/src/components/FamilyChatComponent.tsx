import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Send, Image as ImageIcon, Loader2, ArrowDown, X, Download } from 'lucide-react';
import { chatService, FamilyMessage } from '@/services/ChatService';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

interface FamilyChatComponentProps {
  householdId: string;
  relativeName: string;
}

export const FamilyChatComponent = ({ householdId, relativeName }: FamilyChatComponentProps) => {
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
    chatService.subscribeToMessages(householdId, handleNewMessage);

    return () => {
      chatService.unsubscribe();
    };
  }, [householdId]);

  // Track if user was at bottom before messages update
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    // Only auto-scroll if user was at bottom
    if (wasAtBottomRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 0);
    }
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      console.log('[Chat] Loading messages for household:', householdId);
      const data = await chatService.getMessages(householdId);
      console.log('[Chat] Loaded messages:', data);
      setMessages(data);
      setHasMoreMessages(data.length >= 50);
    } catch (error) {
      console.error('[Chat] Failed to load messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      console.log('[Chat] Loading more messages before:', oldestMessage.created_at);
      
      const olderMessages = await chatService.getMessages(householdId, 50, oldestMessage.created_at);
      
      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
        setHasMoreMessages(olderMessages.length >= 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('[Chat] Failed to load more messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load older messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleNewMessage = (message: FamilyMessage) => {
    console.log('[Chat] New message received via realtime:', message);
    setMessages((prev) => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) {
        console.log('[Chat] Message already exists, skipping duplicate');
        return prev;
      }
      const filtered = prev.filter(m => 
        !(m.id.startsWith('temp-') && m.message === message.message)
      );
      return [...filtered, message];
    });
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    const isNearTop = target.scrollTop < 100;
    
    setShowScrollButton(!isNearBottom);
    wasAtBottomRef.current = isNearBottom;

    // Load more messages when scrolling near top
    if (isNearTop && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || isSending) return;

    const messageText = newMessage.trim();
    const imageFile = selectedImage;
    
    setIsSending(true);
    
    // Create temp message for optimistic UI
    const tempMessage: FamilyMessage = {
      id: `temp-${Date.now()}`,
      household_id: householdId,
      sender_id: 'temp',
      sender_type: 'family',
      message: messageText || null,
      message_type: imageFile ? 'image' : 'text',
      image_url: imageFile ? imagePreview : null,
      created_at: new Date().toISOString(),
      read_at: null,
      deleted_at: null,
    };
    
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    setSelectedImage(null);
    setImagePreview(null);
    wasAtBottomRef.current = true;
    
    try {
      if (imageFile) {
        console.log('[Chat] Uploading image...');
        const imageUrl = await chatService.uploadImage(householdId, imageFile);
        console.log('[Chat] Image uploaded, sending message...');
        await chatService.sendImageMessage(householdId, imageUrl, messageText || undefined);
      } else {
        console.log('[Chat] Sending text message:', messageText);
        await chatService.sendTextMessage(householdId, messageText);
      }
      console.log('[Chat] Message sent successfully');
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      setMessages((prev) => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageText);
      setSelectedImage(imageFile);
      setImagePreview(tempMessage.image_url);
      toast({
        title: 'Send Failed',
        description: 'Unable to send your message. Please try again.',
        variant: 'destructive',
        duration: 4000,
      });
    } finally {
      setIsSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select JPG, PNG, GIF, or WebP images only',
        variant: 'destructive',
        duration: 4000,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Image Too Large',
        description: 'Please choose an image smaller than 5MB',
        variant: 'destructive',
        duration: 4000,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setSelectedImage(file);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleViewImage = (imageUrl: string) => {
    setViewImageUrl(imageUrl);
    setIsImageDialogOpen(true);
  };

  const handleDownloadImage = async () => {
    if (!viewImageUrl) return;
    
    try {
      const response = await fetch(viewImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Downloaded',
        description: 'Image saved successfully',
        duration: 2000,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to download image',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'hh:mm a');
  };

  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const groupMessagesByDate = (messages: FamilyMessage[]) => {
    const groups: { date: string; messages: FamilyMessage[] }[] = [];
    let currentDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = format(startOfDay(new Date(message.created_at)), 'yyyy-MM-dd');
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);
  const currentDateLabel = messages.length > 0 
    ? formatDateSeparator(new Date(messages[messages.length - 1].created_at))
    : 'Today';

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle>Chat with {relativeName}</CardTitle>
      </CardHeader>
      
      <Separator />

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 relative">
        {/* Dynamic island date indicator - fixed overlay */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm border border-border/50 px-4 py-1.5 rounded-full shadow-lg">
            <span className="text-xs font-medium text-muted-foreground">
              {currentDateLabel}
            </span>
          </div>
        </div>

        <div className="flex-1 relative min-h-0">
          <ScrollArea className="h-full">
            <div ref={scrollViewportRef} className="p-4 pt-12">
              {isLoadingMore && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading older messages...</span>
                </div>
              )}
              
              {isLoading ? (
                <div className="flex items-center justify-center h-full py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8 text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <div className="space-y-4">
                  {messageGroups.map((group, groupIndex) => (
                    <div key={group.date}>
                      {/* Show date separator only for non-current dates when scrolling history */}
                      {groupIndex < messageGroups.length - 1 && (
                        <div className="flex justify-center mb-4">
                          <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                            {formatDateSeparator(new Date(group.date))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-4">
                      {group.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.sender_type === 'family' ? 'flex-row-reverse' : 'flex-row'
                          }`}
                        >
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className={msg.sender_type === 'family' ? 'bg-primary text-primary-foreground' : ''}>
                              {msg.sender_type === 'family' ? 'F' : 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`flex flex-col gap-1 max-w-[70%] ${
                              msg.sender_type === 'family' ? 'items-end' : 'items-start'
                            }`}
                          >
                            <span className="text-xs text-muted-foreground px-1">
                              {msg.sender_type === 'family' ? 'You' : relativeName}
                            </span>
                            {msg.message_type === 'text' ? (
                              <div
                                className={`rounded-2xl px-4 py-2 ${
                                  msg.sender_type === 'family'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm break-words">{msg.message}</p>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="relative">
                                  {msg.id.startsWith('temp-') ? (
                                    <div className="rounded-lg bg-muted animate-pulse h-48 w-64 flex items-center justify-center">
                                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <img
                                      src={msg.image_url || ''}
                                      alt="Shared image"
                                      className="rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                      onClick={() => handleViewImage(msg.image_url || '')}
                                      onError={(e) => {
                                        console.error('[Chat] Image load error:', msg.image_url);
                                        // Only show placeholder if not a temp message
                                        if (!msg.id.startsWith('temp-')) {
                                          e.currentTarget.style.display = 'none';
                                          const parent = e.currentTarget.parentElement;
                                          if (parent && !parent.querySelector('.error-placeholder')) {
                                            const placeholder = document.createElement('div');
                                            placeholder.className = 'error-placeholder rounded-lg bg-muted h-48 w-64 flex items-center justify-center text-muted-foreground text-sm';
                                            placeholder.textContent = 'Image unavailable';
                                            parent.appendChild(placeholder);
                                          }
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                                {msg.message && (
                                  <div
                                    className={`rounded-2xl px-4 py-2 ${
                                      msg.sender_type === 'family'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}
                                  >
                                    <p className="text-sm break-words">{msg.message}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground px-2">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {showScrollButton && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-4 right-4 rounded-full shadow-lg z-10"
              onClick={() => scrollToBottom()}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-shrink-0 p-4 border-t bg-background">
          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-3 relative inline-block">
              <div className="relative rounded-lg overflow-hidden border-2 border-primary/20">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-32 rounded-lg object-cover"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full"
                  onClick={handleRemoveImage}
                  disabled={isSending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedImage?.name}
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={isSending}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="flex-shrink-0"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Input
              placeholder={imagePreview ? "Add a caption (optional)..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isSending}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isSending || (!newMessage.trim() && !selectedImage)} 
              className="flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Image Viewer Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle>Image</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadImage}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </DialogHeader>
          <div className="p-4 pt-0">
            <img
              src={viewImageUrl || ''}
              alt="Full size"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
