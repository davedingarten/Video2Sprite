export async function checkCodecSupport(
  codec: string,
  width: number,
  height: number,
  description?: Uint8Array,
): Promise<void> {
  if (typeof VideoDecoder === 'undefined') {
    throw new Error(
      'WebCodecs VideoDecoder is not available in this browser. Try Chrome, Edge, or Safari 16.4+.',
    );
  }
  const result = await VideoDecoder.isConfigSupported({
    codec,
    codedWidth: width,
    codedHeight: height,
    description,
  });
  if (!result.supported) {
    throw new Error(`Codec "${codec}" is not supported by this browser.`);
  }
}
