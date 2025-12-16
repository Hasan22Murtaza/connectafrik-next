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
 *
 * Note: This service requires @capacitor/camera and @capacitor/core packages.
 * For web environments, it will fall back to web APIs.
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

// Type declarations for optional Capacitor imports
type CapacitorCamera = typeof import('@capacitor/camera')
type CapacitorCore = typeof import('@capacitor/core')

class NativeCameraService {
  private cameraModule: CapacitorCamera | null = null
  private capacitorModule: CapacitorCore | null = null
  private initialized = false

  /**
   * Initialize Capacitor modules (only if available)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Try to dynamically import Capacitor modules
      const [camera, capacitor] = await Promise.all([
        import('@capacitor/camera').catch(() => null),
        import('@capacitor/core').catch(() => null)
      ])

      this.cameraModule = camera
      this.capacitorModule = capacitor
    } catch (error) {
      // Capacitor not available - this is fine for web environments
      console.log('Capacitor modules not available, using web fallbacks')
    }

    this.initialized = true
  }

  /**
   * Check if running on native platform (iOS or Android)
   */
  isNative(): boolean {
    if (typeof window === 'undefined') return false
    return this.capacitorModule?.Capacitor?.isNativePlatform() ?? false
  }

  /**
   * Get platform name
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    if (typeof window === 'undefined') return 'web'
    return (this.capacitorModule?.Capacitor?.getPlatform() as 'ios' | 'android' | 'web') ?? 'web'
  }

  /**
   * Take a photo using native camera
   * For profile pictures, post images, etc.
   * Falls back to web camera API if Capacitor is not available
   */
  async takePhoto(options: CameraOptions = {}): Promise<string> {
    await this.initialize()

    // Use Capacitor if available
    if (this.cameraModule && this.isNative()) {
      try {
        const { Camera, CameraResultType, CameraSource, CameraDirection } = this.cameraModule
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
        console.error('Error taking photo with Capacitor:', error)
        throw new Error(`Failed to take photo: ${error.message}`)
      }
    }

    // Web fallback using HTML5 camera API
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'
      
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('No file selected'))
          return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
          resolve(event.target?.result as string)
        }
        reader.onerror = () => {
          reject(new Error('Failed to read file'))
        }
        reader.readAsDataURL(file)
      }

      input.oncancel = () => {
        reject(new Error('Camera cancelled'))
      }

      input.click()
    })
  }

  /**
   * Pick an existing photo from gallery
   * Falls back to web file picker if Capacitor is not available
   */
  async pickFromGallery(options: CameraOptions = {}): Promise<string> {
    await this.initialize()

    // Use Capacitor if available
    if (this.cameraModule && this.isNative()) {
      try {
        const { Camera, CameraResultType, CameraSource } = this.cameraModule
        const photo = await Camera.getPhoto({
          quality: options.quality || 90,
          source: CameraSource.Photos,
          resultType: CameraResultType.DataUrl,
          width: options.width,
          height: options.height
        })

        return photo.dataUrl || ''
      } catch (error: any) {
        console.error('Error picking photo with Capacitor:', error)
        throw new Error(`Failed to pick photo: ${error.message}`)
      }
    }

    // Web fallback using file input
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('No file selected'))
          return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
          resolve(event.target?.result as string)
        }
        reader.onerror = () => {
          reject(new Error('Failed to read file'))
        }
        reader.readAsDataURL(file)
      }

      input.oncancel = () => {
        reject(new Error('File picker cancelled'))
      }

      input.click()
    })
  }

  /**
   * Request camera permissions
   * Required before accessing camera on iOS/Android
   * Falls back to web permissions API if Capacitor is not available
   */
  async requestPermissions(): Promise<boolean> {
    await this.initialize()

    // Use Capacitor if available
    if (this.cameraModule && this.isNative()) {
      try {
        const { Camera } = this.cameraModule
        const permissions = await Camera.requestPermissions()
        return permissions.camera === 'granted'
      } catch (error: any) {
        console.error('Error requesting permissions:', error)
        return false
      }
    }

    // Web fallback using Permissions API
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
        return permission.state === 'granted'
      } catch (error) {
        // Permissions API not supported, assume granted for web
        return true
      }
    }

    // Fallback: assume granted for web
    return true
  }

  /**
   * Check if camera permissions are granted
   * Falls back to web permissions API if Capacitor is not available
   */
  async checkPermissions(): Promise<boolean> {
    await this.initialize()

    // Use Capacitor if available
    if (this.cameraModule && this.isNative()) {
      try {
        const { Camera } = this.cameraModule
        const permissions = await Camera.checkPermissions()
        return permissions.camera === 'granted'
      } catch (error: any) {
        console.error('Error checking permissions:', error)
        return false
      }
    }

    // Web fallback using Permissions API
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
        return permission.state === 'granted'
      } catch (error) {
        // Permissions API not supported, assume granted for web
        return true
      }
    }

    // Fallback: assume granted for web
    return true
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
