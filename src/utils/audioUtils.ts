import * as alphaTab from "@coderline/alphatab";

/**
 * Convert Float32Array chunks to WAV Blob URL (IEEE float 32)
 */
export function convertSamplesToWavBlobUrl(chunks: Float32Array[], sampleRate: number): string {
    const samples = chunks.reduce((p, c) => p + c.length, 0);
    const wavHeaderSize = 44;
    const fileSize = wavHeaderSize + samples * 4;
    const buffer = alphaTab.io.ByteBuffer.withCapacity(fileSize);

    // 写 WAV 头
    buffer.write(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0, 4); // RIFF
    alphaTab.io.IOHelper.writeInt32LE(buffer, fileSize - 8); // file size
    buffer.write(new Uint8Array([0x57, 0x41, 0x56, 0x45]), 0, 4); // WAVE

    buffer.write(new Uint8Array([0x66, 0x6D, 0x74, 0x20]), 0, 4); // fmt\u2420
    alphaTab.io.IOHelper.writeInt32LE(buffer, 16); // block size
    alphaTab.io.IOHelper.writeInt16LE(buffer, 3); // audio format (1=WAVE_FORMAT_IEEE_FLOAT)
    const channels = 2;
    alphaTab.io.IOHelper.writeInt16LE(buffer, channels); // number of channels
    alphaTab.io.IOHelper.writeInt32LE(buffer, sampleRate); // sample rate
    alphaTab.io.IOHelper.writeInt32LE(buffer, Float32Array.BYTES_PER_ELEMENT * channels * sampleRate); // bytes/second
    const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
    alphaTab.io.IOHelper.writeInt16LE(buffer, channels * Math.floor((bitsPerSample + 7) / 8)); // block align
    alphaTab.io.IOHelper.writeInt16LE(buffer, bitsPerSample); // bits per sample

    buffer.write(new Uint8Array([0x64, 0x61, 0x74, 0x61]), 0, 4); // data
    alphaTab.io.IOHelper.writeInt32LE(buffer, samples * 4);
    for (const c of chunks) {
        const bytes = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
        buffer.write(bytes, 0, bytes.length);
    }

    const blob: Blob = new Blob([buffer.toArray()], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}
