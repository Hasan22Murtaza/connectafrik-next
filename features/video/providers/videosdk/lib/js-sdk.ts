// Real VideoSDK implementation using @videosdk.live/js-sdk

import * as VideoSDKModule from '@videosdk.live/js-sdk';

// Access the VideoSDK namespace from the module
const VideoSDK = (VideoSDKModule as any).VideoSDK || VideoSDKModule;

export { VideoSDK };
