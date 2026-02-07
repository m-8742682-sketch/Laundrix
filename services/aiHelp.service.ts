import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/services/firebase";

const functions = getFunctions(app);

export const getHelpCenterResponse = async (prompt: string) => {
  const callAI = httpsCallable(functions, "helpCenterAssistant");

  const result = await callAI({ prompt });

  return result.data as string;
};
