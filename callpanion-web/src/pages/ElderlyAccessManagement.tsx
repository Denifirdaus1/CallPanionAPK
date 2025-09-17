import RelativeNavigation from "@/components/RelativeNavigation";
import ElderlyAccessManager from "@/components/ElderlyAccessManager";

const ElderlyAccessManagement = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Elderly Access Management</h1>
          <p className="text-muted-foreground">
            Manage secure access links for your elderly family members
          </p>
        </div>

        <ElderlyAccessManager />
      </div>
    </div>
  );
};

export default ElderlyAccessManagement;