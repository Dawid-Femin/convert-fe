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

export async function compressImage(
  file: File,
  quality?: number,
  palette?: boolean,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);
  if (quality !== undefined) formData.append("quality", String(quality));
  if (palette) formData.append("palette", "true");

  const { data } = await api.post("/compress", formData, {
    responseType: "blob",
  });
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
  startTime?: string,
  endTime?: string,
): Promise<{ jobId: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetFormat", targetFormat);
  if (quality !== undefined) formData.append("quality", String(quality));
  if (resolution) formData.append("resolution", resolution);
  if (startTime) formData.append("startTime", startTime);
  if (endTime) formData.append("endTime", endTime);

  const { data } = await api.post("/video/convert", formData);
  return data;
}

export async function submitExtractAudio(
  file: File,
  format: string,
  bitrate?: number,
): Promise<{ jobId: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("format", format);
  if (bitrate !== undefined) formData.append("bitrate", String(bitrate));

  const { data } = await api.post("/video/extract-audio", formData);
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

// Audio API

export interface AudioFormats {
  input: string[];
  output: string[];
}

export interface AudioJobStatus {
  jobId: string;
  status: "pending" | "active" | "completed" | "failed";
  progress: number;
  error?: string;
}

export async function getAudioFormats(): Promise<AudioFormats> {
  const { data } = await api.get<AudioFormats>("/audio/formats");
  return data;
}

export async function submitAudioConversion(
  file: File,
  targetFormat: string,
  bitrate?: number,
): Promise<{ jobId: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetFormat", targetFormat);
  if (bitrate !== undefined) formData.append("bitrate", String(bitrate));

  const { data } = await api.post("/audio/convert", formData);
  return data;
}

export async function getAudioJobStatus(jobId: string): Promise<AudioJobStatus> {
  const { data } = await api.get<AudioJobStatus>(`/audio/jobs/${jobId}`);
  return data;
}

export async function downloadAudioJob(jobId: string): Promise<Blob> {
  const { data } = await api.get(`/audio/jobs/${jobId}/download`, {
    responseType: "blob",
  });
  return data;
}
