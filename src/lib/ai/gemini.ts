import { GoogleGenerativeAI } from "@google/generative-ai";
import { VertexAI } from "@google-cloud/vertexai";

type LegacyResponseShape = {
  response: {
    text: () => string;
  };
};

function toLegacyResponse(text: string): LegacyResponseShape {
  return {
    response: {
      text: () => text,
    },
  };
}

function extractVertexText(resp: Awaited<ReturnType<ReturnType<VertexAI["getGenerativeModel"]>["generateContent"]>>) {
  const parts = resp.response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

const vertexProject = process.env.GOOGLE_CLOUD_PROJECT;
const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION;
const apiKey = process.env.GEMINI_API_KEY;

if (!vertexProject && !apiKey) {
  throw new Error(
    "Missing AI configuration. Set either GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION."
  );
}

const vertexModel =
  vertexProject && vertexLocation
    ? new VertexAI({ project: vertexProject, location: vertexLocation }).getGenerativeModel({
        model: "gemini-2.0-flash",
      })
    : null;

const apiKeyModel = apiKey
  ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-2.0-flash" })
  : null;

// Keep a compatible shape so existing routes don't need refactors.
export const model = {
  async generateContent(prompt: string): Promise<LegacyResponseShape> {
    if (vertexModel) {
      const response = await vertexModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return toLegacyResponse(extractVertexText(response));
    }

    if (!apiKeyModel) {
      throw new Error("AI model is not configured.");
    }

    const response = await apiKeyModel.generateContent(prompt);
    const text = await response.response.text();
    return toLegacyResponse(text);
  },
  
  async generateContentFromAudio(base64Audio: string, mimeType: string, prompt: string): Promise<string> {
    const inlineData = { data: base64Audio, mimeType };
    
    if (vertexModel) {
      const response = await vertexModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData }] }],
      });
      return extractVertexText(response);
    }

    if (!apiKeyModel) {
      throw new Error("AI model is not configured.");
    }

    const response = await apiKeyModel.generateContent([
      prompt,
      { inlineData }
    ]);
    return response.response.text();
  }
};
