export function downloadBlob(data: Uint8Array | string | Blob, filename: string, mimeType?: string): void {
  const blob =
    data instanceof Blob ? data : new Blob([typeof data === "string" ? data : new Uint8Array(data)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
