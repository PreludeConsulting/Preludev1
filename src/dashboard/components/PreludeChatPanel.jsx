import { useLocation } from "react-router-dom";
import { Bot, Sparkles } from "lucide-react";
import DashboardAIChat from "./DashboardAIChat.jsx";

export default function PreludeChatPanel() {
  const location = useLocation();
  const initialPrompt = location.state?.prompt || "";

  return (
    <div className="dash-ai-layout">
      <aside className="dash-ai-layout__sidebar">
        <div className="dash-ai-convo dash-ai-convo--active">
          <Sparkles className="h-4 w-4" />
          <span>Prelude AI</span>
        </div>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Powered by Prelude&apos;s admissions knowledge base. Ask specific questions for the best answers.
        </p>
        <div className="dash-ai-layout__hint">
          <Bot className="h-4 w-4" />
          <span>Colleges · Scholarships · Programs · Activities · CS · SAT/ACT</span>
        </div>
      </aside>
      <div className="dash-ai-layout__main">
        <DashboardAIChat key={initialPrompt || "default"} initialPrompt={initialPrompt} />
      </div>
    </div>
  );
}
