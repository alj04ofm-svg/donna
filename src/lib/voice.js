const { spawn } = require("node:child_process");
const path = require("node:path");

// Spawns the persistent Python TTS worker (loads the clone model once, then
// synthesizes each line to a WAV and plays it with afplay). Ships behind the
// config.voice flag so text answers work instantly without the model.
function createVoice({ ref, venvPython }) {
  const proc = spawn(venvPython, [path.join(__dirname, "../../tts/tts_service.py")], {
    env: { ...process.env, XIMENA_REF: ref },
  });
  proc.stderr.on("data", (d) => console.error("[tts]", String(d).trim()));
  proc.stdout.on("data", (d) =>
    String(d).trim().split("\n").forEach((l) => {
      if (l === "READY") return;
      if (l.endsWith(".wav")) spawn("afplay", [l]);
    })
  );
  return {
    speak(text) { proc.stdin.write(text.replace(/\n/g, " ") + "\n"); },
  };
}
module.exports = { createVoice };
