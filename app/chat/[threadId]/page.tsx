import ChatPageView from "@/features/chat/components/ChatPageView";

interface ChatThreadPageProps {
  params: Promise<{ threadId: string }>;
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  const { threadId } = await params;
  return <ChatPageView selectedThreadId={decodeURIComponent(threadId)} />;
}
