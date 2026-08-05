import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "IKne3meq5aSn9XLyUdCD";

if (!apiKey) {
  throw new Error("Add ELEVENLABS_API_KEY to .env.local first.");
}

const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "xi-api-key": apiKey,
  },
  body: JSON.stringify({
    text: "[theatrical] Ooooh! [gasp] Ah! Ooooh, stop it! [playful] ...actually, don't.",
    model_id: "eleven_v3",
    voice_settings: {
      stability: 0.2,
      similarity_boost: 0.78,
      style: 0.82,
      use_speaker_boost: true,
    },
  }),
});

if (!response.ok) {
  throw new Error(`ElevenLabs returned ${response.status}: ${await response.text()}`);
}

const outputDirectory = resolve("public/audio");
const outputPath = resolve(outputDirectory, "jeff-poke.mp3");
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
console.log(`Generated ${outputPath}`);
