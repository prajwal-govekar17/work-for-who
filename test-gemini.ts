import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCl9tiw6ooZ8ucwKOPtwX8iokChZnbCEfQ";
const ai = new GoogleGenerativeAI(apiKey);

async function run() {
  // Try using gemini-1.5-flash
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    await model.generateContent("hello");
    console.log("gemini-1.5-flash worked");
  } catch (e: any) {
    console.log("gemini-1.5-flash failed:", e.message);
  }

  // Try gemini-1.5-flash-latest
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    await model.generateContent("hello");
    console.log("gemini-1.5-flash-latest worked");
  } catch (e: any) {
    console.log("gemini-1.5-flash-latest failed:", e.message);
  }

  // Try gemini-pro
  try {
    const model = ai.getGenerativeModel({ model: "gemini-pro" });
    await model.generateContent("hello");
    console.log("gemini-pro worked");
  } catch (e: any) {
    console.log("gemini-pro failed:", e.message);
  }
}

run();
