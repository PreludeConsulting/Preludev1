import { deriveActiveConversationState } from "./flowState.js";
import { handleComparisonFlow } from "./handlers/comparisonHandler.js";
import { handleEssayFlow } from "./handlers/essayHandler.js";
import { handleSchoolFlow } from "./handlers/schoolHandler.js";

const FLOW_HANDLERS = [handleEssayFlow, handleSchoolFlow, handleComparisonFlow];

export function routeActiveConversation({ message, conversationHistory = [] }) {
  const flowState = deriveActiveConversationState(message, conversationHistory);
  if (!flowState.active) return null;

  for (const handler of FLOW_HANDLERS) {
    const result = handler({ message, conversationHistory, flowState });
    if (result) {
      return {
        ...result,
        conversationState: {
          ...flowState.knownContext,
          recentMessages: flowState.recentMessages,
          activeFlow: result.activeFlow ?? {
            mode: flowState.mode,
            stage: flowState.stage
          }
        }
      };
    }
  }

  return null;
}
