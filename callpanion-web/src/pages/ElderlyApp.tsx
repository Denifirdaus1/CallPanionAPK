import React from 'react';
import ElderlyInterface from '@/components/ElderlyInterface';

const ElderlyApp: React.FC = () => {
  return (
    <div className="elderly-app">
      {/* Main elderly interface - Push notifications now handled by Flutter native */}
      <ElderlyInterface />
    </div>
  );
};

export default ElderlyApp;