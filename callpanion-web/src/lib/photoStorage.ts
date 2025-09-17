export interface PhotoComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface FamilyPhoto {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: string;
  alt: string;
  likes: number;
  comments: PhotoComment[];
}

const STORAGE_KEY = 'family-photos';

export const getFamilyPhotos = (): FamilyPhoto[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading family photos:', error);
    return [];
  }
};

export const saveFamilyPhoto = (photo: Omit<FamilyPhoto, 'id' | 'uploadedAt' | 'likes' | 'comments'>): FamilyPhoto => {
  const newPhoto: FamilyPhoto = {
    ...photo,
    id: Date.now().toString(),
    uploadedAt: new Date().toISOString(),
    likes: 0,
    comments: []
  };
  
  const existingPhotos = getFamilyPhotos();
  const updatedPhotos = [newPhoto, ...existingPhotos];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPhotos));
  return newPhoto;
};

export const deleteFamilyPhoto = (id: string): void => {
  const existingPhotos = getFamilyPhotos();
  const updatedPhotos = existingPhotos.filter(photo => photo.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPhotos));
};

export const likePhoto = (id: string): FamilyPhoto | null => {
  const photos = getFamilyPhotos();
  const updated = photos.map((p) =>
    p.id === id ? { ...p, likes: (p.likes ?? 0) + 1 } : p
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((p) => p.id === id) || null;
};

export const addPhotoComment = (
  id: string,
  comment: Omit<PhotoComment, 'id' | 'createdAt'>
): FamilyPhoto | null => {
  const photos = getFamilyPhotos();
  const updated = photos.map((p) => {
    if (p.id === id) {
      const newComment: PhotoComment = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...comment,
      };
      return { ...p, comments: [...(p.comments ?? []), newComment] };
    }
    return p;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((p) => p.id === id) || null;
};

// Default photos for empty state
export const getDefaultPhotos = (): FamilyPhoto[] => [
  {
    id: 'default-1',
    url: 'https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=400&h=300&fit=crop',
    caption: 'Upload your family photos to share memories',
    uploadedBy: 'Family',
    uploadedAt: new Date().toISOString(),
    alt: 'Family photo placeholder',
    likes: 0,
    comments: []
  },
  {
    id: 'default-2', 
    url: 'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=400&h=300&fit=crop',
    caption: 'Share your favorite moments together',
    uploadedBy: 'Family',
    uploadedAt: new Date().toISOString(),
    alt: 'Family photo placeholder',
    likes: 0,
    comments: []
  },
  {
    id: 'default-3',
    url: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=300&fit=crop',
    caption: 'Create lasting connections through photos',
    uploadedBy: 'Family',
    uploadedAt: new Date().toISOString(),
    alt: 'Family photo placeholder',
    likes: 0,
    comments: []
  }
];