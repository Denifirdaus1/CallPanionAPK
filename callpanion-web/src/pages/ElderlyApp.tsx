import React, { useState } from 'react';
import ElderlyInterface from '@/components/ElderlyInterface';
import PushNotificationHandler from '@/components/PushNotificationHandler';

const ElderlyApp: React.FC = () => {
  const [incomingCallData, setIncomingCallData] = useState<any>(null);

  const handleIncomingCall = (callData: any) => {
    setIncomingCallData(callData);
  };

  const handleCallScheduled = (callData: any) => {
    console.log('Call scheduled:', callData);
  };

  return (
    <div className="elderly-app">
      {/* Push notification handler (invisible) */}
      <PushNotificationHandler 
        onIncomingCall={handleIncomingCall}
        onCallScheduled={handleCallScheduled}
      />
      
      {/* Main elderly interface */}
      <ElderlyInterface />
    </div>
  );
};

export default ElderlyApp;