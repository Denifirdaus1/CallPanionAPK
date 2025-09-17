import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@/hooks/useUserRole';
import ElderLayout from './components/ElderLayout';
import ElderHomePage from './pages/ElderHomePage';
import ElderVoice from './pages/ElderVoice';
import ElderMessages from './pages/ElderMessages';
import ElderToday from './pages/ElderToday';
import ElderHelpPage from './pages/ElderHelpPage';

interface ElderAppProps {
  userRole: UserRole | null;
  onUnauthorized: () => void;
}

const ElderApp = ({ userRole, onUnauthorized }: ElderAppProps) => {
  // Check if user is authorized for elder app
  if (userRole && !userRole.role.includes('elder')) {
    onUnauthorized();
    return null;
  }

  return (
    <ElderLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<ElderHomePage />} />
        <Route path="/voice" element={<ElderVoice />} />
        <Route path="/messages" element={<ElderMessages />} />
        <Route path="/today" element={<ElderToday />} />
        <Route path="/help" element={<ElderHelpPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ElderLayout>
  );
};

export default ElderApp;