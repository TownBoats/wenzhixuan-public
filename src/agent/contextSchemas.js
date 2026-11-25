import { ASK_QUESTION_DESCRIPTION, ASK_QUESTION_INPUT_SCHEMA } from './tools/askQuestion.js';
import { VISUALIZE_DESCRIPTION, VISUALIZE_INPUT_SCHEMA } from './tools/visualize.js';
import {
  UPDATE_LEARNING_PLAN_DESCRIPTION,
  UPDATE_LEARNING_PLAN_INPUT_SCHEMA,
} from './tools/updateLearningPlan.js';
import { EXPLAIN_CARD_DESCRIPTION, EXPLAIN_CARD_INPUT_SCHEMA } from './tools/explainCard.js';

// Reuse the actual tool declarations, without constructing or executing tools.
const DEFINITIONS = {
  update_learning_plan: [UPDATE_LEARNING_PLAN_DESCRIPTION, UPDATE_LEARNING_PLAN_INPUT_SCHEMA],
  ask_question: [ASK_QUESTION_DESCRIPTION, ASK_QUESTION_INPUT_SCHEMA],
  visualize: [VISUALIZE_DESCRIPTION, VISUALIZE_INPUT_SCHEMA],
  explain_card: [EXPLAIN_CARD_DESCRIPTION, EXPLAIN_CARD_INPUT_SCHEMA],
};

export function contextToolDefinitions(mode) {
  return (mode?.toolNames ?? []).flatMap((name) => {
    const definition = DEFINITIONS[name];
    return definition ? [{ name, description: definition[0], parameters: definition[1].jsonSchema }] : [];
  });
}
