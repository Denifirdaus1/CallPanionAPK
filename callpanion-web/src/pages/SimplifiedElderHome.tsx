import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ElderlyDashboard from "@/components/ElderlyDashboard";

const SimplifiedElderHome = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [elderName, setElderName] = useState<string>("Friend");
  const { user, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to pairing if not signed in
    if (!session || !user) {
      navigate('/pair');
      return;
    }

    // Load stored device info
    try {
      const storedDeviceId = localStorage.getItem('callpanion_device_id');
      const storedHouseholdId = localStorage.getItem('callpanion_household_id');
      
      if (storedDeviceId && storedHouseholdId) {
        setDeviceId(storedDeviceId);
        setHouseholdId(storedHouseholdId);
        
        // Extract name from user metadata or email
        const displayName = user.user_metadata?.display_name || 
                           user.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 
                           "Friend";
        setElderName(displayName.charAt(0).toUpperCase() + displayName.slice(1));
      } else {
        // If no device info but signed in, redirect to pairing
        navigate('/pair');
        return;
      }
    } catch (error) {
      console.warn('Failed to load stored device info:', error);
      navigate('/pair');
      return;
    }

    // Set up heartbeat to update last_seen_at
    const updateHeartbeat = async () => {
      try {
        // In production, this would update the device's last_seen_at
        console.log('Elder device heartbeat:', new Date().toISOString());
      } catch (error) {
        console.warn('Heartbeat update failed:', error);
      }
    };

    updateHeartbeat();
    const heartbeatInterval = setInterval(updateHeartbeat, 30000);

    // Set up realtime subscription for device notifications
    let realtimeChannel;
    if (deviceId) {
      realtimeChannel = supabase
        .channel(`elder_device:${deviceId}`)
        .on('broadcast', { event: 'family_ping' }, () => {
          console.log('Received ping from family');
        })
        .on('broadcast', { event: 'incoming_call' }, () => {
          console.log('Incoming call notification received');
        })
        .subscribe();
    }

    return () => {
      clearInterval(heartbeatInterval);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [session, user, navigate, deviceId]);

  if (!session || !deviceId) {
    return null; // Will redirect via useEffect
  }

  return (
    <ElderlyDashboard 
      elderName={elderName}
      isTokenAccess={false}
    />
  );
};

export default SimplifiedElderHome;