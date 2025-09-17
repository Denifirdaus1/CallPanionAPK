import { ReactNode } from 'react';

interface ElderLayoutProps {
  children: ReactNode;
}

const ElderLayout = ({ children }: ElderLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex flex-col">
      {/* Simple header */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary">CallPanion</h1>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Simple footer */}
      <footer className="bg-white border-t px-6 py-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          Need help? Press the Help button or call your family.
        </div>
      </footer>
    </div>
  );
};

export default ElderLayout;