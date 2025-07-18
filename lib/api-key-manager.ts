const apiKeys = [
  process.env.GOOGLE_API_KEY,
  // Add more keys here if needed, e.g. process.env.GOOGLE_API_KEY_2
].filter(Boolean);

let currentKeyIndex = 0;

export const apiKeyManager = {
  getNextGoogleKey: async () => {
    if (apiKeys.length === 0) throw new Error("No Google API key configured");
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return key;
  },
}; 