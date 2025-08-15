import * as alphaTab from "@coderline/alphatab";

/**
 * Convert Float32Array chunks to a WAV blob URL. Uses alphaTab.io.ByteBuffer/IOHelper when available
 * to avoid reimplementing endianness helpers; falls back to a pure-JS implementation otherwise.
 */
export function convertSamplesToWavBlobUrl(chunks: Float32Array[], sampleRate = 44100): string {
    const samples = chunks.reduce((p, c) => p + c.length, 0);
    const wavHeaderSize = 44;
    const fileSize = wavHeaderSize + samples * 4;

    try {
        // try using alphaTab ByteBuffer if present for compatibility
        // @ts-ignore
        if (alphaTab && (alphaTab as any).io && (alphaTab as any).io.ByteBuffer) {
            // @ts-ignore
            const buffer = (alphaTab as any).io.ByteBuffer.withCapacity(fileSize);
            // RIFF
            buffer.write(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0, 4);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt32LE(buffer, fileSize - 8);
            buffer.write(new Uint8Array([0x57, 0x41, 0x56, 0x45]), 0, 4);
            // fmt 
            buffer.write(new Uint8Array([0x66, 0x6d, 0x74, 0x20]), 0, 4);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt32LE(buffer, 16);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt16LE(buffer, 3); // float
            const channels = 2;
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt16LE(buffer, channels);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt32LE(buffer, sampleRate);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt32LE(buffer, Float32Array.BYTES_PER_ELEMENT * channels * sampleRate);
            const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt16LE(buffer, channels * Math.floor((bitsPerSample + 7) / 8));
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt16LE(buffer, bitsPerSample);
            // data chunk
            buffer.write(new Uint8Array([0x64, 0x61, 0x74, 0x61]), 0, 4);
            // @ts-ignore
            (alphaTab as any).io.IOHelper.writeInt32LE(buffer, samples * 4);
            for (const c of chunks) {
                const bytes = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
                buffer.write(bytes, 0, bytes.length);
            }
            const blob: Blob = new Blob([buffer.toArray()], { type: "audio/wav" });
            return URL.createObjectURL(blob);
        }
    } catch (e) {
        // fall back to JS implementation below
        console.warn("audioUtils: alphaTab helpers unavailable, falling back to pure JS WAV builder", e);
    }

    // Pure JS builder: little-endian writes
    const dataBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(dataBuffer);
    let offset = 0;
    function writeString(s: string) {
        for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
    }
    function writeInt32(v: number) { view.setUint32(offset, v, true); offset += 4; }
    function writeInt16(v: number) { view.setUint16(offset, v, true); offset += 2; }

    writeString('RIFF');
    writeInt32(fileSize - 8);
    writeString('WAVE');
    writeString('fmt ');
    writeInt32(16);
    writeInt16(3); // IEEE float
    const channels = 2;
    writeInt16(channels);
    writeInt32(sampleRate);
    writeInt32(Float32Array.BYTES_PER_ELEMENT * channels * sampleRate);
    const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
    writeInt16(channels * Math.floor((bitsPerSample + 7) / 8));
    writeInt16(bitsPerSample);
    writeString('data');
    writeInt32(samples * 4);
    // write samples
    let pos = offset;
    for (const c of chunks) {
        const f32 = c;
        for (let i = 0; i < f32.length; i++) {
            view.setFloat32(pos, f32[i], true);
            pos += 4;
        }
    }

    const blob = new Blob([dataBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}
