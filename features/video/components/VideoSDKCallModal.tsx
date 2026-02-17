import { PhoneOff } from 'lucide-react';
import React from 'react';
import {
  AddPeoplePanel,
  CallControls,
  CallStatusOverlay,
  IncomingCallControls,
  MessageInput,
  ParticipantVideo,
  ScreenShareOverlay,
  useVideoCall,
} from './call';
import type { VideoSDKCallModalProps } from './call';

const VideoSDKCallModal: React.FC<VideoSDKCallModalProps> = (props) => {
  const vc = useVideoCall(props);

  // Don't render if not open
  if (!props.isOpen && vc.callStatus === 'connecting') return null;
  if (!props.isOpen) return null;

  const userInitial = (vc.user?.user_metadata?.full_name || 'Y')[0].toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] bg-black animate-fadeIn">
      <div className="bg-black w-full h-full overflow-hidden">
        {/* Video/Audio Content - Fullscreen */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full h-screen overflow-hidden">
          {/* Remote Video - 1-on-1 call (single full-screen, HD) */}
          {vc.remoteStreams.length > 0 && vc.callType === 'video' && vc.participants.length <= 1 && (
            <div className="w-full h-full">
              <video
                ref={vc.remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
              />
            </div>
          )}

          {/* Remote Video Grid - Group call (2+ remote participants) */}
          {vc.callType === 'video' && vc.participants.length > 1 && (
            <div className={`w-full h-full grid gap-1 p-1 ${
              vc.participants.length === 2 ? 'grid-cols-2' :
              vc.participants.length <= 4 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {vc.participants.map((p: any) => {
                const videoStream = vc.participantVideoMap.get(p.id);
                return (
                  <div key={p.id} className="relative bg-gray-800 rounded-lg overflow-hidden min-h-0">
                    {videoStream ? (
                      <ParticipantVideo stream={videoStream} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                          <span className="text-xl sm:text-2xl font-bold text-white">
                            {(p.displayName || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 text-[10px] sm:text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
                      {p.displayName || 'Participant'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Local Video PiP - hidden during screen share (shown in sidebar instead) */}
          {vc.localStream && vc.callType === 'video' && vc.localStream.getVideoTracks().length > 0 && !vc.remoteScreenShareStream && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-20 h-28 sm:w-24 sm:h-32 md:w-32 md:h-44 lg:w-36 lg:h-48 bg-gray-800 rounded-lg md:rounded-xl overflow-hidden border border-white sm:border-2 shadow-xl sm:shadow-2xl ring-1 ring-white/20 sm:ring-2 hover:scale-105 transition-transform duration-200">
              <video
                ref={vc.localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
              />
            </div>
          )}

          {/* Audio Call Avatar */}
          {vc.callType === 'audio' && (
            <div className="flex items-center justify-center h-full px-4">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-2xl ring-2 sm:ring-4 ring-primary-200/50 animate-pulse-glow">
                {vc.callStatus !== 'ringing' && (
                  <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white text-center px-2 break-words">
                    {vc.isIncoming ? vc.decodedCallerName : vc.decodedRecipientName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Participants Count - hidden during screen share (shown in banner instead) */}
          {vc.callStatus === 'connected' && !vc.remoteScreenShareStream && !vc.isScreenSharing && (() => {
            const displayCount = vc.getParticipantCount();
            return (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-black/60 backdrop-blur-md text-white px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-4 md:py-2 rounded-full text-[10px] sm:text-xs md:text-sm font-medium shadow-lg border border-white/20">
                <span className="flex items-center gap-1 sm:gap-2">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="hidden sm:inline">{displayCount} participant{displayCount > 1 ? 's' : ''}</span>
                  <span className="sm:hidden">{displayCount}</span>
                </span>
              </div>
            );
          })()}

          <audio ref={vc.remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Call Status Overlay */}
          <CallStatusOverlay
            callStatus={vc.callStatus}
            callDuration={vc.callDuration}
            formatDuration={vc.formatDuration}
            isIncoming={vc.isIncoming}
            decodedCallerName={vc.decodedCallerName}
            decodedRecipientName={vc.decodedRecipientName}
            isScreenSharing={vc.isScreenSharing}
            remoteScreenShareStream={vc.remoteScreenShareStream}
          />

          {/* Accept/Reject Buttons for incoming calls */}
          {vc.callStatus === 'ringing' && vc.isIncoming && (
            <IncomingCallControls
              isAcceptingCall={vc.isAcceptingCall}
              onAccept={vc.handleAcceptCall}
              onReject={vc.handleRejectCall}
            />
          )}

          {/* Screen Share Overlay (remote + local banner) */}
          <ScreenShareOverlay
            remoteScreenShareStream={vc.remoteScreenShareStream}
            screenShareParticipantName={vc.screenShareParticipantName}
            isScreenSharing={vc.isScreenSharing}
            callDuration={vc.callDuration}
            formatDuration={vc.formatDuration}
            getParticipantCount={vc.getParticipantCount}
            localStream={vc.localStream}
            callType={vc.callType}
            participants={vc.participants}
            participantVideoMap={vc.participantVideoMap}
            userInitial={userInitial}
            onStopSharing={vc.toggleScreenShare}
          />

          {/* End Call Button Overlay - Inside video section for outgoing calls */}
          {vc.callStatus === 'ringing' && !vc.isIncoming && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-4 sm:pb-6 md:pb-8 mb-20 sm:mb-0 px-4 z-30 pointer-events-auto">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={vc.handleEndCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-3 sm:p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
                  title="Drop Call"
                  aria-label="Drop call"
                >
                  <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                </button>
              </div>
            </div>
          )}

          {/* Controls Overlay */}
          {vc.callStatus === 'connected' && (
            <CallControls
              isMuted={vc.isMuted}
              isVideoEnabled={vc.isVideoEnabled}
              isScreenSharing={vc.isScreenSharing}
              remoteScreenShareStream={vc.remoteScreenShareStream}
              screenShareParticipantName={vc.screenShareParticipantName}
              speakerLevel={vc.speakerLevel}
              callType={vc.callType}
              showMessageInput={vc.showMessageInput}
              showAddPeople={vc.showAddPeople}
              onToggleMute={vc.toggleMute}
              onToggleVideo={vc.toggleVideo}
              onToggleScreenShare={vc.toggleScreenShare}
              onToggleSpeaker={vc.toggleSpeaker}
              onToggleMessageInput={() => vc.setShowMessageInput(!vc.showMessageInput)}
              onToggleAddPeople={() => vc.setShowAddPeople(!vc.showAddPeople)}
              onEndCall={vc.handleEndCall}
            />
          )}
        </div>

        {/* Add People Panel */}
        {vc.showAddPeople && (
          <AddPeoplePanel
            addPeopleSearch={vc.addPeopleSearch}
            addPeopleResults={vc.addPeopleResults}
            participants={vc.participants}
            invitingUserId={vc.invitingUserId}
            onSearchChange={(value) => vc.setAddPeopleSearch(value)}
            onClose={() => {
              vc.setShowAddPeople(false);
              vc.setAddPeopleSearch('');
            }}
            onInvite={vc.handleInviteToCall}
          />
        )}

        {/* Controls */}
        <div className="p-2 sm:p-3 md:p-4 lg:p-6">
          {vc.callStatus === 'connected' && (
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {vc.showMessageInput && (
                <MessageInput
                  messageText={vc.messageText}
                  onMessageChange={(value) => vc.setMessageText(value)}
                  onSend={vc.handleSendMessage}
                  onClose={() => {
                    vc.setShowMessageInput(false);
                    vc.setMessageText('');
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { VideoSDKCallModal };
export type { VideoSDKCallModalProps };
export default VideoSDKCallModal;
