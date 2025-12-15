import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

/**
 * Native Camera Service for ConnectAfrik Reels
 *
 * This service provides native camera access for iOS and Android,
 * solving the web camera zoom issue where selfies are too close.
 *
 * Benefits of Native Camera:
 * - Full field of view (no web camera zoom issues)
 * - Better quality video recording
 * - Native camera controls
 * - Better performance
 * - Access to device camera features (flash, zoom, etc.)
 */

export interface CameraOptions {
  direction?: 'front' | 'back'
  quality?: number // 0-100
  width?: number
  height?: number
}

export interface VideoRecordingOptions {
  direction?: 'front' | 'back'
  duration?: number // Maximum duration in seconds
  quality?: 'low' | 'medium' | 'high'
}

class NativeCameraService {
  /**
   * Check if running on native platform (iOS or Android)
   */
  isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  /**
   * Get platform name
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    return Capacitor.getPlatform() as 'ios' | 'android' | 'web'
  }

  /**
   * Take a photo using native camera
   * For profile pictures, post images, etc.
   */
  async takePhoto(options: CameraOptions = {}): Promise<string> {
    try {
      const photo = await Camera.getPhoto({
        quality: options.quality || 90,
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        direction: options.direction === 'front' ? CameraDirection.Front : CameraDirection.Rear,
        width: options.width,
        height: options.height,
        saveToGallery: false
      })

      return photo.dataUrl || ''
    } catch (error: any) {
      console.error('Error taking photo:', error)
      throw new Error(`Failed to take photo: ${error.message}`)
    }
  }

  /**
   * Pick an existing photo from gallery
   */
  async pickFromGallery(options: CameraOptions = {}): Promise<string> {
    try {
      const photo = await Camera.getPhoto({
        quality: options.quality || 90,
        source: CameraSource.Photos,
        resultType: CameraResultType.DataUrl,
        width: options.width,
        height: options.height
      })

      return photo.dataUrl || ''
    } catch (error: any) {
      console.error('Error picking photo:', error)
      throw new Error(`Failed to pick photo: ${error.message}`)
    }
  }

  /**
   * Request camera permissions
   * Required before accessing camera on iOS/Android
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permissions = await Camera.requestPermissions()
      return permissions.camera === 'granted'
    } catch (error: any) {
      console.error('Error requesting permissions:', error)
      return false
    }
  }

  /**
   * Check if camera permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const permissions = await Camera.checkPermissions()
      return permissions.camera === 'granted'
    } catch (error: any) {
      console.error('Error checking permissions:', error)
      return false
    }
  }

  /**
   * Record video for Reels using native camera
   * This is a simplified implementation - you'll want to use a dedicated
   * video recording plugin like @capacitor-community/camera-preview
   * for full video recording with preview
   *
   * For now, this shows how to access the camera.
   * For video recording, recommend installing @capacitor-community/camera-preview
   */
  async openCameraForVideo(options: VideoRecordingOptions = {}): Promise<void> {
    // For video recording, you'll want to use a more specialized plugin
    // like @capacitor-community/camera-preview which provides:
    // - Live camera preview
    // - Video recording with controls
    // - Better field of view
    // - Native camera UI

    console.warn('Video recording requires @capacitor-community/camera-preview plugin')
    console.warn('Install with: npm install @capacitor-community/camera-preview')

    // For now, open camera for photo as fallback
    // This will be replaced with proper video recording
    await this.requestPermissions()
  }

  /**
   * Get available camera devices (front, back)
   */
  async getAvailableCameras(): Promise<string[]> {
    // This is a placeholder - actual implementation depends on platform APIs
    // Most devices have 'front' and 'back' cameras
    return ['front', 'back']
  }
}

export const nativeCameraService = new NativeCameraService()
