import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Formats {
  input: string[];
  output: string[];
}

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  size: number;
  density?: number;
}

export async function getFormats(): Promise<Formats> {
  const { data } = await api.get<Formats>("/formats");
  return data;
}

export async function convertImage(
  file: File,
  targetFormat: string,
  quality?: number,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetFormat", targetFormat);
  if (quality !== undefined) formData.append("quality", String(quality));

  const { data } = await api.post("/convert", formData, {
    responseType: "blob",
  });
  return data;
}

export async function getImageMetadata(
  file: File,
): Promise<ImageMetadata> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ImageMetadata>("/metadata", formData);
  return data;
}
