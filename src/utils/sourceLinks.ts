const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function buildMankaiSourceLink(apiUrl: string): string {
  let value = 0n;
  for (const byte of new TextEncoder().encode(apiUrl)) {
    value = value * 256n + BigInt(byte);
  }

  let encoded = "";
  do {
    encoded = BASE62_ALPHABET[Number(value % 62n)] + encoded;
    value /= 62n;
  } while (value > 0n);

  return `mankai://add-plugins?http=${encoded}`;
}
