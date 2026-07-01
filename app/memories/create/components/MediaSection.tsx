'use client'

import React from 'react'
import {
  AlertCircle,
  Camera,
  Film,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { MAX_REEL_DURATION, REEL_ASPECT_RATIOS } from '@/shared/types/reels'

interface PreviewStyle {
  containerClass: string
  width: string
  height: string
  cameraWidth: number
  cameraHeight: number
}

export interface MediaSectionProps {
  recordingMode: 'upload' | 'record'
  setRecordingMode: (mode: 'upload' | 'record') => void
  videoFile: File | null
  videoUrl: string
  videoDuration: number
  thumbnailUrl: string
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3'
  aspectRatioCss: Record<string, string>
  previewStyle: PreviewStyle
  isDragging: boolean
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  volume: number
  isRecording: boolean
  isPaused: boolean
  recordingTime: number
  cameraError: string | null
  cameraFacing: 'user' | 'environment'
  validationError: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  formatTime: (seconds: number) => string
  formatFileSize: (bytes: number) => string
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onBrowseClick: () => void
  onVideoInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onStartCamera: (facing: 'user' | 'environment') => void
  onFlipCamera: () => void
  onStopCamera: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onPauseRecording: () => void
  onResumeRecording: () => void
  onDiscardRecording: () => void
  onClearVideo: () => void
  onPlayPause: () => void
  onTimeUpdate: () => void
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
  onMuteToggle: () => void
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVideoEnded: () => void
}

export function MediaSection({
  recordingMode,
  setRecordingMode,
  videoFile,
  videoUrl,
  videoDuration,
  thumbnailUrl,
  aspectRatio,
  aspectRatioCss,
  previewStyle,
  isDragging,
  isPlaying,
  isMuted,
  currentTime,
  volume,
  isRecording,
  isPaused,
  recordingTime,
  cameraError,
  cameraFacing,
  validationError,
  videoRef,
  fileInputRef,
  formatTime,
  formatFileSize,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onBrowseClick,
  onVideoInputChange,
  onStartCamera,
  onFlipCamera,
  onStopCamera,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onDiscardRecording,
  onClearVideo,
  onPlayPause,
  onTimeUpdate,
  onSeek,
  onMuteToggle,
  onVolumeChange,
  onVideoEnded,
}: MediaSectionProps) {
  const previewFrameClass = `relative overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-black/10 transition-all duration-300 ${previewStyle.containerClass}`

  return (
    <section
      aria-labelledby="media-section-heading"
      className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 id="media-section-heading" className="text-base font-semibold text-content">
            Video
          </h2>
          <p className="mt-0.5 text-xs text-content-secondary sm:text-sm">
            Upload or record a short video for your memory
          </p>
        </div>
        {videoFile && (
          <button
            type="button"
            onClick={onClearVideo}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:text-sm"
            aria-label="Remove video"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        )}
      </div>

      {!videoFile && recordingMode === 'upload' ? (
        <div className="space-y-4">
          <div
            role="tablist"
            aria-label="Video source"
            className="grid grid-cols-2 gap-2 rounded-xl bg-surface-canvas p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected
              onClick={() => setRecordingMode('upload')}
              className="flex items-center justify-center gap-2 rounded-lg bg-surface px-3 py-2.5 text-sm font-medium text-content shadow-sm ring-1 ring-border transition-all"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Upload
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => {
                setRecordingMode('record')
                onStartCamera('user')
              }}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-content-secondary transition-all hover:text-content"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Record
            </button>
          </div>

          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={onBrowseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onBrowseClick()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload video. Drag and drop or click to browse."
            className={`group cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:p-10 ${
              isDragging
                ? 'border-[var(--african-orange)] bg-[color-mix(in_srgb,var(--african-orange)_10%,var(--surface))] scale-[1.01]'
                : 'border-border hover:border-[color-mix(in_srgb,var(--african-orange)_45%,var(--border))] hover:bg-surface-canvas'
            }`}
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                isDragging
                  ? 'bg-[color-mix(in_srgb,var(--african-orange)_18%,var(--surface))]'
                  : 'bg-surface-secondary group-hover:bg-[color-mix(in_srgb,var(--african-orange)_12%,var(--surface-secondary))]'
              }`}
            >
              <Upload
                className={`h-7 w-7 ${isDragging ? 'text-[var(--african-orange)]' : 'text-content-tertiary'}`}
                aria-hidden
              />
            </div>
            <p className="text-sm font-semibold text-content sm:text-base">
              {isDragging ? 'Drop your video here' : 'Drag & drop or click to upload'}
            </p>
            <p className="mt-1.5 text-xs text-content-secondary sm:text-sm">
              MP4, MOV, WebM up to 100MB · Max {MAX_REEL_DURATION / 60} minutes
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onBrowseClick()
              }}
              className="btn-primary mt-4 text-sm"
            >
              Browse files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={onVideoInputChange}
              className="sr-only"
              aria-hidden
            />
          </div>

          {validationError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      ) : recordingMode === 'record' && !videoFile ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              className={previewFrameClass}
              style={{ aspectRatio: aspectRatioCss[aspectRatio] || '9/16', maxHeight: '70vh' }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <span>{REEL_ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.icon}</span>
                <span>{aspectRatio}</span>
              </div>

              <button
                type="button"
                onClick={onFlipCamera}
                className="absolute right-3 top-3 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                title={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
                aria-label={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              {isRecording && !isPaused && (
                <div className="absolute left-1/2 top-3 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 backdrop-blur-sm">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    <span className="text-xs font-medium text-white">REC</span>
                  </div>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10">
                {isRecording && (
                  <div className="mb-3 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                      <div
                        className={`h-2 w-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`}
                      />
                      <span className="font-mono text-sm font-medium text-white">
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={onStartRecording}
                      className="rounded-full bg-red-600 p-4 text-white shadow-lg shadow-red-600/30 transition-transform hover:scale-105 active:scale-95"
                      aria-label="Start recording"
                    >
                      <Camera className="h-6 w-6" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={isPaused ? onResumeRecording : onPauseRecording}
                        className="rounded-full bg-yellow-500 p-3 text-white transition-transform hover:scale-105"
                        aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                      >
                        {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                      </button>
                      <button
                        type="button"
                        onClick={onStopRecording}
                        className="rounded-full bg-white p-3 text-red-600 ring-2 ring-red-400 transition-transform hover:scale-105"
                        aria-label="Stop recording"
                      >
                        <Square className="h-5 w-5 fill-current" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button type="button" onClick={onStopCamera} className="btn-secondary text-sm">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </button>
          </div>

          {cameraError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {cameraError}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              className={previewFrameClass}
              style={{ aspectRatio: aspectRatioCss[aspectRatio] || '9/16', maxHeight: '70vh' }}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                className="h-full w-full object-contain"
                onTimeUpdate={onTimeUpdate}
                onEnded={onVideoEnded}
                playsInline
              />

              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <span>{REEL_ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.icon}</span>
                <span>{aspectRatio}</span>
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-8 sm:p-4 sm:pt-10">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onPlayPause}
                    className="shrink-0 text-white transition-colors hover:text-white/80"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <input
                      type="range"
                      min={0}
                      max={videoDuration || 0}
                      value={currentTime}
                      onChange={onSeek}
                      className="slider h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/30"
                      aria-label="Seek video"
                    />
                    <div className="mt-0.5 flex justify-between text-[10px] text-white/80">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(videoDuration)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onMuteToggle}
                      className="text-white transition-colors hover:text-white/80"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={volume}
                      onChange={onVolumeChange}
                      className="slider hidden h-1 w-12 cursor-pointer appearance-none rounded-lg bg-white/30 sm:block"
                      aria-label="Volume"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {videoFile && (
            <div className="rounded-xl border border-border bg-surface-canvas p-3 sm:p-4">
              <div className="flex items-start gap-3">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                    <Film className="h-5 w-5 text-content-tertiary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{videoFile.name}</p>
                  <p className="mt-0.5 text-xs text-content-secondary">
                    {formatFileSize(videoFile.size)} · {formatTime(videoDuration)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onBrowseClick}
                  className="shrink-0 text-xs font-medium text-[var(--african-orange)] hover:underline sm:text-sm"
                >
                  Replace
                </button>
              </div>
            </div>
          )}

          {recordingMode === 'record' && videoFile && (
            <div className="flex justify-center">
              <button type="button" onClick={onDiscardRecording} className="btn-secondary text-sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                Record again
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={onVideoInputChange}
            className="sr-only"
            aria-hidden
          />
        </div>
      )}

      {!videoFile && recordingMode === 'upload' && (
        <p className="mt-3 text-center text-[11px] text-content-tertiary sm:text-xs">
          Vertical 9:16 videos work best in the feed
        </p>
      )}
    </section>
  )
}
