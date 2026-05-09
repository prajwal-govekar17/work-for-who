import { NextResponse } from "next/server";
import { model } from "@/lib/ai/gemini";

export async function POST(req: Request) {
  try {
    const { base64Audio, mimeType } = await req.json();

    if (!base64Audio || !mimeType) {
      return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
    }

    const prompt = "You are a professional transcriber. Transcribe the following audio accurately. If the audio contains a worker describing their situation or reporting a safety issue, transcribe it exactly as they say it. Only output the transcription, nothing else. If the audio is completely silent or incomprehensible, output nothing.";

    const transcription = await model.generateContentFromAudio(base64Audio, mimeType, prompt);

    return NextResponse.json({ success: true, text: transcription.trim() });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
