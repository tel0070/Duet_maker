export function downloadBlob(data: Uint8Array | string, filename: string, mimeType: string): void {
  const part: BlobPart = typeof data === "string" ? data : new Uint8Array(data);
  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
