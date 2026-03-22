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

// Video API

export interface VideoFormats {
  input: string[];
  output: string[];
}

export interface VideoJobStatus {
  jobId: string;
  status: "pending" | "active" | "completed" | "failed";
  progress: number;
  error?: string;
}

export async function getVideoFormats(): Promise<VideoFormats> {
  const { data } = await api.get<VideoFormats>("/video/formats");
  return data;
}

export async function submitVideoConversion(
  file: File,
  targetFormat: string,
  quality?: number,
  resolution?: string,
): Promise<{ jobId: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetFormat", targetFormat);
  if (quality !== undefined) formData.append("quality", String(quality));
  if (resolution) formData.append("resolution", resolution);

  const { data } = await api.post("/video/convert", formData);
  return data;
}

export async function getVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  const { data } = await api.get<VideoJobStatus>(`/video/jobs/${jobId}`);
  return data;
}

export async function downloadVideoJob(jobId: string): Promise<Blob> {
  const { data } = await api.get(`/video/jobs/${jobId}/download`, {
    responseType: "blob",
  });
  return data;
}
