import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("Missing GEMINI_API_KEY environment variable");
}

export async function generateMemorySummary(
  seriesName: string,
  description: string,
  genres: string[]
): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
      Generate a concise memory summary for an AI translation assistant for a webtoon/manga/manhua series with these details:
      
      Title: ${seriesName}
      Genres: ${genres.join(", ")}
      Description: ${description}
      
      The memory summary should:
      1. Capture key aspects of the series setting, premise, and tone
      2. Be concise but comprehensive (150-200 words)
      3. Include genre-specific elements that would be helpful for translation
      4. Focus on elements that would influence translation style and terminology
      
      Format the response as a well-structured paragraph without any header or preamble.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (error) {
    console.error("Error generating memory summary:", error);
    return "";
  }
}
