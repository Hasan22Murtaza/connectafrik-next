import React from 'react';

interface MessageInputProps {
  messageText: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  messageText,
  onMessageChange,
  onSend,
  onClose,
}) => {
  return (
    <div className="flex gap-1.5 sm:gap-2 animate-slideIn">
      <input
        type="text"
        value={messageText}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onSend();
          }
        }}
        placeholder="Type a message..."
        className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-gray-300 outline-1 border-gray-300 transition-all duration-200 text-xs sm:text-sm text-white bg-gray-800/50 backdrop-blur-sm"
        autoFocus
      />
      <button
        onClick={onSend}
        className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-3 py-2 sm:px-4 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-offset-2"
      >
        Send
      </button>
      <button
        onClick={onClose}
        className="bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 px-3 py-2 sm:px-4 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium focus:outline-none"
      >
        Cancel
      </button>
    </div>
  );
};

export default MessageInput;
