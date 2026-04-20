"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import {
  fileUploadService,
  type FileUploadResult,
} from "@/shared/services/fileUploadService";

interface ChatWebcamCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the captured photo as a file upload preview (same as gallery pick). */
  onCaptured: (files: FileUploadResult[]) => void;
}

/**
 * Opens the device camera via getUserMedia (laptop webcam uses facingMode "user").
 */
const ChatWebcamCapture: React.FC<ChatWebcamCaptureProps> = ({
  isOpen,
  onClose,
  onCaptured,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setError(null);
      return;
    }

    let cancelled = false;

    const start = async () => {
      setError(null);
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          el.muted = true;
          el.setAttribute("playsinline", "true");
          await el.play();
          setReady(true);
        }
      } catch {
        setError("Could not open the camera. Allow access or check that no other app is using it.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen, stopStream]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCapturing(false);
        return;
      }
      ctx.drawImage(video, 0, 0);
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(
          async (blob) => {
            try {
              if (!blob) {
                reject(new Error("No image"));
                return;
              }
              const file = new File([blob], `camera-${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
              const results = await fileUploadService.fromFiles([file]);
              if (results.length) {
                stopStream();
                onCaptured(results);
                onClose();
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          "image/jpeg",
          0.92
        );
      });
    } catch {
      setError("Could not capture photo.");
    } finally {
      setCapturing(false);
    }
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">Camera</span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              Starting camera…
            </div>
          )}
        </div>

        {error && (
          <p className="px-4 py-2 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCapture}
            disabled={!ready || capturing || !!error}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {capturing ? "Saving…" : "Capture"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWebcamCapture;
