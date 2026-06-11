import { Sparkles } from "lucide-react";
import GuidedAssistant from "../../components/GuidedAssistant.jsx";

export default function PreludeChatPanel() {
  return (
    <div className="dash-ai-layout">
      <aside className="dash-ai-layout__sidebar">
        <div className="dash-ai-convo dash-ai-convo--active">
          <Sparkles className="h-4 w-4" />
          <span>Guided session</span>
        </div>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Choose a topic or type a short phrase to route to a predefined flow.
        </p>
      </aside>
      <div className="dash-ai-layout__main">
        <GuidedAssistant className="guided-assistant--dashboard" />
      </div>
    </div>
  );
}
