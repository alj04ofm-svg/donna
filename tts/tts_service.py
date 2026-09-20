#!/usr/bin/env python3
"""
Donna local voice-out — persistent Ximena voice-clone worker.

ENGINE: XTTS-v2 (Coqui) by default. During Task 9's bake-off, if F5-TTS wins on
this Mac, replace the model load + synth calls below with the F5-TTS API
(keep the same stdin→wav-path-on-stdout protocol).

Protocol: loads the model ONCE, prints "READY", then for each line on stdin
synthesizes speech in the Ximena voice (reference clip = $XIMENA_REF) and prints
the output WAV path on stdout. The Electron voice.js worker plays it with afplay.
"""
import sys
import os
import tempfile

REF = os.environ["XIMENA_REF"]

from TTS.api import TTS  # coqui-tts

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")  # first run downloads the model
print("READY", flush=True)

for line in sys.stdin:
    text = line.strip()
    if not text:
        continue
    out = os.path.join(tempfile.gettempdir(), f"donna_{abs(hash(text))}.wav")
    tts.tts_to_file(text=text, speaker_wav=REF, language="en", file_path=out)
    print(out, flush=True)
