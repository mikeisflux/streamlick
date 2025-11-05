import { useEffect, useState } from 'react';

export interface HotkeyFeedbackMessage {
  id: string;
  text: string;
  icon?: string;
  timestamp: number;
}

interface HotkeyFeedbackProps {
  messages: HotkeyFeedbackMessage[];
}

export function HotkeyFeedback({ messages }: HotkeyFeedbackProps) {
  const [visibleMessages, setVisibleMessages] = useState<HotkeyFeedbackMessage[]>([]);

  useEffect(() => {
    // Show new messages
    const newMessages = messages.filter(
      (msg) => !visibleMessages.find((vm) => vm.id === msg.id)
    );

    if (newMessages.length > 0) {
      setVisibleMessages([...visibleMessages, ...newMessages]);

      // Remove messages after 2 seconds
      newMessages.forEach((msg) => {
        setTimeout(() => {
          setVisibleMessages((prev) => prev.filter((m) => m.id !== msg.id));
        }, 2000);
      });
    }
  }, [messages]);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3 shadow-2xl animate-fade-in-down"
        >
          <div className="flex items-center gap-3">
            {message.icon && (
              <span className="text-2xl">{message.icon}</span>
            )}
            <span className="text-white font-medium">{message.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook to manage hotkey feedback
export function useHotkeyFeedback() {
  const [messages, setMessages] = useState<HotkeyFeedbackMessage[]>([]);

  const showFeedback = (text: string, icon?: string) => {
    const message: HotkeyFeedbackMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      icon,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
  };

  return { messages, showFeedback };
}
