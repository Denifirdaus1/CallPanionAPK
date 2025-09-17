import { supabase as supabaseClient } from "@/integrations/supabase/client";
import {
  getFamilyPhotos as getFamilyPhotosLocal,
  saveFamilyPhoto as saveFamilyPhotoLocal,
  deleteFamilyPhoto as deleteFamilyPhotoLocal,
  likePhoto as likePhotoLocal,
  addPhotoComment as addPhotoCommentLocal,
  getDefaultPhotos,
  type FamilyPhoto,
  type PhotoComment,
} from './photoStorage';

// Use centralized Supabase client
const supabase: any = supabaseClient as any;

export { getDefaultPhotos };
export type { FamilyPhoto, PhotoComment };

export async function listPhotos(): Promise<FamilyPhoto[]> {
  if (!supabase) return getFamilyPhotosLocal();
  try {
    // Attempt to fetch photos and comments. If tables don't exist, fallback
    const { data, error } = await supabase
      .from('family_photos')
      .select('id,url,caption,uploaded_by,uploaded_at,alt,likes,photo_comments(id,author,text,created_at)')
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    const mapped: FamilyPhoto[] = (data || []).map((row: any) => ({
      id: String(row.id),
      url: row.url,
      caption: row.caption,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      alt: row.alt,
      likes: row.likes ?? 0,
      comments: (row.photo_comments || []).map((c: any) => ({
        id: String(c.id),
        author: c.author,
        text: c.text,
        createdAt: c.created_at,
      })) as PhotoComment[],
    }));

    return mapped;
  } catch (e) {
    console.warn('Supabase listPhotos failed, falling back to local storage', e);
    return getFamilyPhotosLocal();
  }
}

export async function uploadPhoto(photo: Omit<FamilyPhoto, 'id' | 'uploadedAt' | 'likes' | 'comments'>): Promise<FamilyPhoto> {
  if (!supabase) return Promise.resolve(saveFamilyPhotoLocal(photo));
  try {
    const payload = {
      url: photo.url,
      caption: photo.caption,
      uploaded_by: photo.uploadedBy,
      uploaded_at: new Date().toISOString(),
      alt: photo.alt,
      likes: 0,
    };
    const { data, error } = await supabase
      .from('family_photos')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    const created: FamilyPhoto = {
      id: String(data.id),
      url: data.url,
      caption: data.caption,
      uploadedBy: data.uploaded_by,
      uploadedAt: data.uploaded_at,
      alt: data.alt,
      likes: data.likes ?? 0,
      comments: [],
    };
    return created;
  } catch (e) {
    console.warn('Supabase uploadPhoto failed, falling back to local storage', e);
    return saveFamilyPhotoLocal(photo);
  }
}

export async function removePhoto(id: string): Promise<void> {
  if (!supabase) return Promise.resolve(deleteFamilyPhotoLocal(id));
  try {
    const { error } = await supabase.from('family_photos').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.warn('Supabase removePhoto failed, falling back to local storage', e);
    deleteFamilyPhotoLocal(id);
  }
}

export async function likePhotoRemote(id: string): Promise<FamilyPhoto | null> {
  if (!supabase) return Promise.resolve(likePhotoLocal(id));
  try {
    const { data: updated, error } = await supabase
      .rpc('increment_photo_likes', { photo_id: id });
    if (error) throw error;

    // Re-fetch comments to return a complete object
    const { data: withComments } = await supabase
      .from('family_photos')
      .select('id,url,caption,uploaded_by,uploaded_at,alt,likes,photo_comments(id,author,text,created_at)')
      .eq('id', id)
      .single();

    if (!withComments) return null;

    return {
      id: String(withComments.id),
      url: withComments.url,
      caption: withComments.caption,
      uploadedBy: withComments.uploaded_by,
      uploadedAt: withComments.uploaded_at,
      alt: withComments.alt,
      likes: withComments.likes ?? 0,
      comments: (withComments.photo_comments || []).map((c: any) => ({
        id: String(c.id),
        author: c.author,
        text: c.text,
        createdAt: c.created_at,
      })),
    } as FamilyPhoto;
  } catch (e) {
    console.warn('Supabase likePhoto failed, falling back to local storage', e);
    return likePhotoLocal(id);
  }
}

export async function addPhotoCommentRemote(
  id: string,
  comment: Omit<PhotoComment, 'id' | 'createdAt'>
): Promise<FamilyPhoto | null> {
  if (!supabase) return Promise.resolve(addPhotoCommentLocal(id, comment));
  try {
    const payload = {
      photo_id: id,
      author: comment.author,
      text: comment.text,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('photo_comments').insert(payload);
    if (error) throw error;

    // Return updated photo with comments
    const { data: withComments, error: fetchErr } = await supabase
      .from('family_photos')
      .select('id,url,caption,uploaded_by,uploaded_at,alt,likes,photo_comments(id,author,text,created_at)')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (!withComments) return null;

    return {
      id: String(withComments.id),
      url: withComments.url,
      caption: withComments.caption,
      uploadedBy: withComments.uploaded_by,
      uploadedAt: withComments.uploaded_at,
      alt: withComments.alt,
      likes: withComments.likes ?? 0,
      comments: (withComments.photo_comments || []).map((c: any) => ({
        id: String(c.id),
        author: c.author,
        text: c.text,
        createdAt: c.created_at,
      })),
    } as FamilyPhoto;
  } catch (e) {
    console.warn('Supabase addPhotoComment failed, falling back to local storage', e);
    return addPhotoCommentLocal(id, comment);
  }
}

export function subscribeToPhotoUpdates(onChange: () => void): () => void {
  if (!supabase) return () => {};
  try {
    const channel = supabase
      .channel('photos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_photos' },
        () => onChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photo_comments' },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  } catch (e) {
    console.warn('Supabase realtime subscribe failed');
    return () => {};
  }
}
