import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const householdId = formData.get('household_id') as string
    const caption = formData.get('caption') as string || ''

    if (!file || !householdId) {
      throw new Error('Missing file or household_id')
    }

    // File validation for security
    const maxFileSize = 50 * 1024 * 1024; // 50MB limit
    if (file.size > maxFileSize) {
      throw new Error('File too large. Maximum size is 50MB')
    }

    // Allowed MIME types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not allowed. Only images and videos are supported')
    }

    // Block potentially dangerous file extensions
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.js', '.jar'];
    const fileName = file.name.toLowerCase();
    if (dangerousExts.some(ext => fileName.endsWith(ext))) {
      throw new Error('File type not allowed for security reasons')
    }

    // Validate user is household member
    const { data: membership, error: memberError } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      throw new Error('Not authorized for this household')
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const bucketName = file.type.startsWith('image/') ? 'family-photos' : 'family-media'
    const storagePath = `${householdId}/${fileName}`

    console.log(`Uploading ${file.name} (${file.size} bytes) to ${bucketName}/${storagePath}`)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // Record in media_uploads table
    const { data: mediaRecord, error: insertError } = await supabase
      .from('media_uploads')
      .insert({
        uploaded_by: user.id,
        household_id: householdId,
        filename: fileName,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        upload_status: 'uploaded'
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // Also add to family_photos for backward compatibility
    if (file.type.startsWith('image/')) {
      // SECURITY FIX: Use private storage, not public URLs
      const { data: signedUrl } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 days

      await supabase
        .from('family_photos')
        .insert({
          url: signedUrl?.signedUrl || '',
          caption,
          uploaded_by: user.email || 'Unknown',
          user_id: user.id,
          household_id: householdId,
          storage_path: storagePath
        })
    }

    // Get household members for notification
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)

    if (!membersError && members?.length) {
      // Send push notifications to other household members
      const otherMembers = members
        .map(m => m.user_id)
        .filter(id => id !== user.id)

      if (otherMembers.length > 0) {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_ids: otherMembers,
            title: 'New family media shared!',
            body: caption || `${user.email} shared a new ${file.type.startsWith('image/') ? 'photo' : 'video'}`,
            data: {
              type: 'media_upload',
              media_id: mediaRecord.id,
              household_id: householdId
            }
          }
        })
      }
    }

    // Update delivery status
    await supabase
      .from('media_uploads')
      .update({
        delivery_status: 'delivered',
        delivered_to: members?.map(m => m.user_id) || []
      })
      .eq('id', mediaRecord.id)

    return new Response(
      JSON.stringify({
        success: true,
        media_id: mediaRecord.id,
        storage_path: storagePath,
        bucket: bucketName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Media upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})