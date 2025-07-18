import { GoogleGenerativeAI } from "@google/generative-ai";
import { apiKeyManager } from "@/config/api-keys";

export async function getGeminiClient() {
  const apiKey = await apiKeyManager.getNextGeminiKey();
  return new GoogleGenerativeAI(apiKey);
}

export async function getGeminiModel() {
  const genAI = await getGeminiClient();
  return genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
}

// Function to get a stable Gemini model for image processing
export async function getGeminiModelForImages() {
  const genAI = await getGeminiClient();
  return genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
}

// Function to get a Gemini model with a specific API key for parallel processing
export async function getGeminiModelWithKey(specificKey?: string) {
  let apiKey: string;

  if (specificKey) {
    apiKey = specificKey;
  } else {
    apiKey = await apiKeyManager.getNextGeminiKey();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
}

// Function to get a Gemini model using a specific API key index for parallel processing
export async function getGeminiModelByIndex(keyIndex: number) {
  const apiKey = await apiKeyManager.getGeminiKeyByIndex(keyIndex);
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
}
