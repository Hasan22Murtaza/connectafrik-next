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

          {/* Teams-style Video Gallery - Group call (2+ remote participants + local) */}
          {vc.callType === 'video' && vc.participants.length > 1 && (() => {
            const tiles = [
              ...vc.participants.map((p: any) => ({
                id: p.id as string,
                displayName: (p.displayName || 'Participant') as string,
                stream: (vc.participantVideoMap.get(p.id) || null) as MediaStream | null,
                isLocal: false,
                hasVideo: !!(vc.participantVideoMap.get(p.id)?.getVideoTracks()?.length),
              })),
              {
                id: 'local',
                displayName: (vc.user?.user_metadata?.full_name || 'You') as string,
                stream: vc.localStream,
                isLocal: true,
                hasVideo: vc.isVideoEnabled && !!(vc.localStream?.getVideoTracks()?.length),
              },
            ];

            const total = tiles.length;
            const cols = total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : total <= 16 ? 4 : 5;
            const rows = Math.ceil(total / cols);

            return (
              <div
                className="w-full h-full flex flex-wrap justify-center content-center p-1.5 sm:p-2 md:p-3"
                style={{ gap: '4px', background: '#1b1b1b' }}
              >
                {tiles.map((tile) => (
                  <div
                    key={tile.id}
                    className="relative overflow-hidden rounded-md sm:rounded-lg"
                    style={{
                      width: `calc(${100 / cols}% - 6px)`,
                      height: `calc(${100 / rows}% - 6px)`,
                      background: '#272727',
                      minHeight: 0,
                    }}
                  >
                    {tile.hasVideo && tile.stream ? (
                      <ParticipantVideo
                        stream={tile.stream}
                        muted={tile.isLocal}
                        mirrored={tile.isLocal}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: '#272727' }}>
                        <div
                          className={`rounded-full flex items-center justify-center ${
                            total <= 4
                              ? 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24'
                              : total <= 9
                                ? 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20'
                                : 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'
                          }`}
                          style={{
                            background: tile.isLocal
                              ? 'linear-gradient(135deg, #5b5fc7, #4f46e5)'
                              : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                          }}
                        >
                          <span
                            className={`font-semibold text-white ${
                              total <= 4
                                ? 'text-xl sm:text-2xl md:text-3xl'
                                : total <= 9
                                  ? 'text-lg sm:text-xl md:text-2xl'
                                  : 'text-base sm:text-lg'
                            }`}
                          >
                            {tile.displayName[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 text-[10px] sm:text-xs text-white/90 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">
                      {tile.isLocal ? 'You' : tile.displayName}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Local Video PiP - only for 1-on-1 calls; hidden during group calls (local is in grid) and screen share */}
          {vc.localStream && vc.callType === 'video' && vc.localStream.getVideoTracks().length > 0 && !vc.remoteScreenShareStream && vc.participants.length <= 1 && (
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
