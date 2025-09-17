import Navigation from "@/components/Navigation";
import FamilyEventPlanner from "@/components/FamilyEventPlanner";

const Calendar = () => {
  return (
    <div className="min-h-screen bg-gradient-peace">
      <Navigation />
      <FamilyEventPlanner />
    </div>
  );
};

export default Calendar;