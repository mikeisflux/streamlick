import { useState } from 'react';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: string | JSX.Element;
  category: string;
}

const faqData: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'What is Streamlick?',
    answer: 'Streamlick is a professional live streaming platform that allows you to broadcast to multiple destinations simultaneously (YouTube, Facebook, Twitch, X, Rumble, LinkedIn, and custom RTMP servers). It features multi-participant video, background effects, chat aggregation, recording, and advanced streaming tools.',
  },
  {
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'Simply click "Get Started" on the homepage and enter your email address. We\'ll send you a magic link to verify your email and create your account. No password required!',
  },
  {
    category: 'Getting Started',
    question: 'What equipment do I need?',
    answer: 'You need a computer with a webcam and microphone, a stable internet connection (at least 5 Mbps upload for 1080p), and a modern web browser (Chrome, Firefox, Edge, or Safari). For best quality, we recommend 20+ Mbps upload for 4K streaming.',
  },

  // Broadcasting
  {
    category: 'Broadcasting',
    question: 'How do I start my first broadcast?',
    answer: (
      <ol className="list-decimal list-inside space-y-2">
        <li>Create a broadcast from your Dashboard</li>
        <li>Configure your streaming destinations in Settings</li>
        <li>Click "Enter Studio" to access the studio interface</li>
        <li>Test your camera and microphone</li>
        <li>Click "Go Live" to start streaming</li>
      </ol>
    ),
  },
  {
    category: 'Broadcasting',
    question: 'Can I stream to multiple platforms at once?',
    answer: 'Yes! Streamlick supports simultaneous multi-streaming to YouTube, Facebook, Twitch, X (Twitter), Rumble, LinkedIn, and any custom RTMP destination. Configure your destinations in Settings, then select which ones to stream to when you go live.',
  },
  {
    category: 'Broadcasting',
    question: 'What video quality does Streamlick support?',
    answer: 'Streamlick supports up to 4K UHD (3840x2160) at 60fps. We offer adaptive bitrate streaming with 7 quality profiles ranging from 360p (600 kbps) to 4K Ultra (20 Mbps). The platform automatically adjusts quality based on your network conditions.',
  },
  {
    category: 'Broadcasting',
    question: 'How do I invite guests to my broadcast?',
    answer: 'In the studio, click the "Invite Guest" button to generate a unique join link. Share this link with your guests. They\'ll join the backstage area where you can promote them to live when ready. No account required for guests!',
  },

  // Destinations & Platforms
  {
    category: 'Destinations & Platforms',
    question: 'Which streaming platforms are supported?',
    answer: 'Streamlick supports YouTube, Facebook, Twitch, X (Twitter), Rumble, LinkedIn, and any custom RTMP server (Restream, Castr, Wowza, etc.). Connect platforms via OAuth in Settings or manually enter RTMP credentials.',
  },
  {
    category: 'Destinations & Platforms',
    question: 'How do I connect my YouTube account?',
    answer: 'Go to Settings → Destinations → Add Destination → YouTube. Click "Connect with OAuth" and authorize Streamlick to access your YouTube account. We\'ll automatically retrieve your stream key and chat.',
  },
  {
    category: 'Destinations & Platforms',
    question: 'Can I use custom RTMP servers?',
    answer: 'Absolutely! Select "Custom RTMP" as your destination type, then enter your RTMP URL and stream key. This works with any RTMP-compatible service including Restream, Castr, Dacast, Wowza, or self-hosted servers.',
  },
  {
    category: 'Destinations & Platforms',
    question: 'What happens if my connection to a platform fails?',
    answer: 'Streamlick features automatic RTMP reconnection with exponential backoff. If a connection drops, we\'ll automatically retry up to 5 times with increasing delays. You can monitor connection status in the Stream Health panel.',
  },

  // Video Features
  {
    category: 'Video Features',
    question: 'What video layouts are available?',
    answer: 'Streamlick offers 4 professional layouts: Grid (equal-sized tiles), Spotlight (main speaker with sidebar thumbnails), Sidebar (main content with vertical participant list), and Picture-in-Picture (overlay). Switch layouts anytime during your stream with keyboard shortcuts (1-4).',
  },
  {
    category: 'Video Features',
    question: 'How do I use virtual backgrounds?',
    answer: 'In the studio sidebar, go to Background Effects and select "Virtual BG". Choose from our default backgrounds or upload your own. For best results with green screen, select "Green Screen" mode and adjust the color picker, similarity, and smoothness settings.',
  },
  {
    category: 'Video Features',
    question: 'Can I share my screen?',
    answer: 'Yes! Click the "Share Screen" button in the studio. You can choose to share your entire screen, a specific window, or a browser tab. System audio capture is supported when available. Screen shares appear as participants in the compositor.',
  },
  {
    category: 'Video Features',
    question: 'How do I add overlays and lower thirds?',
    answer: 'Upload logos and overlays in Settings → Branding. In the studio, use the Overlays panel to show logos, banners, or backgrounds. For lower thirds (name tags), use the compositor service to display speaker names and titles with professional animations.',
  },

  // Chat & Moderation
  {
    category: 'Chat & Moderation',
    question: 'Does Streamlick aggregate chat from all platforms?',
    answer: 'Yes! When you go live, chat from all connected platforms (YouTube, Facebook, Twitch, X, Rumble) is aggregated into a single feed. Each message shows the platform badge and displays Super Chats (YouTube) and Rants (Rumble) with highlighted amounts.',
  },
  {
    category: 'Chat & Moderation',
    question: 'Can I display chat on my stream?',
    answer: 'Yes! Toggle "Show Chat on Stream" in the studio to display recent chat messages in the bottom-right corner of your broadcast. You can customize which messages appear and how long they stay visible.',
  },
  {
    category: 'Chat & Moderation',
    question: 'How do I moderate participants?',
    answer: 'As the host, you have full participant control. Expand any guest\'s card in the sidebar to adjust their volume, mute/unmute them, move them to backstage, kick them from the broadcast, or permanently ban them. Only you can control participants.',
  },

  // Recording & Media
  {
    category: 'Recording & Media',
    question: 'Can I record my broadcasts?',
    answer: 'Yes! Click "Start Recording" in the studio to record your composite stream locally. Recordings are automatically uploaded to your Recordings library in Settings, where you can download or delete them.',
  },
  {
    category: 'Recording & Media',
    question: 'What is the Media Library?',
    answer: 'The Media Library lets you upload video clips, sound effects, and images to use during your streams. Assign hotkeys to clips for instant playback. Perfect for intro/outro videos, stingers, sound effects, and sponsor messages.',
  },
  {
    category: 'Recording & Media',
    question: 'How do I trigger media clips during a stream?',
    answer: 'Upload media to your Media Library and assign hotkeys (e.g., "F1" for intro). During your stream, press the hotkey to play the clip. Video/image clips overlay on your stream, while audio clips play in the background mix.',
  },

  // Technical & Performance
  {
    category: 'Technical & Performance',
    question: 'What is adaptive bitrate streaming?',
    answer: 'Adaptive bitrate automatically adjusts your stream quality based on network conditions. If your connection degrades, Streamlick lowers the bitrate and resolution to prevent buffering. When conditions improve, quality automatically increases. This ensures stable streams even on fluctuating networks.',
  },
  {
    category: 'Technical & Performance',
    question: 'How can I monitor my stream health?',
    answer: 'The Stream Health panel shows real-time metrics including bitrate, framerate, dropped frames, uptime, and network quality. You can see per-destination status with RTT (ping), packet loss, and connection state. Use this to troubleshoot issues.',
  },
  {
    category: 'Technical & Performance',
    question: 'Why is my stream lagging or dropping frames?',
    answer: (
      <div>
        <p className="mb-2">Common causes and solutions:</p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li><strong>Slow upload:</strong> Reduce resolution/bitrate or use adaptive mode</li>
          <li><strong>CPU overload:</strong> Close other applications or reduce stream quality</li>
          <li><strong>Network congestion:</strong> Use wired Ethernet instead of WiFi</li>
          <li><strong>Too many destinations:</strong> Reduce simultaneous streams</li>
          <li><strong>Background effects:</strong> Disable green screen or virtual backgrounds</li>
        </ul>
        <p className="mt-2">Check the Stream Health panel for detailed diagnostics.</p>
      </div>
    ),
  },
  {
    category: 'Technical & Performance',
    question: 'What keyboard shortcuts are available?',
    answer: (
      <div>
        <p className="mb-2">Press <kbd className="px-2 py-1 bg-gray-700 rounded">Shift+?</kbd> in the studio to see all shortcuts. Common ones:</p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li><kbd>M</kbd> - Toggle microphone</li>
          <li><kbd>V</kbd> - Toggle camera</li>
          <li><kbd>Ctrl+L</kbd> - Go live</li>
          <li><kbd>R</kbd> - Toggle recording</li>
          <li><kbd>S</kbd> - Toggle screen share</li>
          <li><kbd>1-4</kbd> - Switch layouts</li>
          <li><kbd>C</kbd> - Toggle chat on stream</li>
        </ul>
      </div>
    ),
  },

  // Billing & Plans
  {
    category: 'Billing & Plans',
    question: 'What subscription plans are available?',
    answer: 'Streamlick offers multiple plans with different streaming hours, participant limits, resolution caps, and features. Visit the Billing page to see current plans and pricing. All plans support multi-streaming and core features.',
  },
  {
    category: 'Billing & Plans',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes! You can cancel your subscription anytime from the Billing page or through the Stripe customer portal. Your subscription remains active until the end of your current billing period, then automatically downgrades to the free plan.',
  },
  {
    category: 'Billing & Plans',
    question: 'Do you offer refunds?',
    answer: 'Subscription fees are generally non-refundable, but we handle refund requests on a case-by-case basis for exceptional circumstances. Contact support@streamlick.com to discuss your situation.',
  },

  // Troubleshooting
  {
    category: 'Troubleshooting',
    question: 'My camera/microphone isn\'t working. What should I do?',
    answer: (
      <ol className="list-decimal list-inside space-y-2">
        <li>Check that your browser has permission to access camera/microphone</li>
        <li>Ensure no other application is using the camera/microphone</li>
        <li>Try refreshing the page or restarting your browser</li>
        <li>Test with a different browser (Chrome recommended)</li>
        <li>Check your system privacy settings</li>
      </ol>
    ),
  },
  {
    category: 'Troubleshooting',
    question: 'My guests can\'t join the broadcast. Why?',
    answer: 'Ensure guests are using the correct join link and have granted camera/microphone permissions. Guests need a modern browser and stable internet. If issues persist, try generating a new join link or ask guests to try a different browser.',
  },
  {
    category: 'Troubleshooting',
    question: 'Chat isn\'t showing up from my platforms. What\'s wrong?',
    answer: 'Verify your OAuth connections are active in Settings → Destinations. Ensure you\'ve authorized the necessary chat permissions (Live Chat API for YouTube, Live Comments for Facebook, etc.). Disconnect and reconnect the platform if needed.',
  },

  // Account & Security
  {
    category: 'Account & Security',
    question: 'How do I change my email address?',
    answer: 'Go to Settings → Account and update your email address. You\'ll receive a verification email at your new address to confirm the change.',
  },
  {
    category: 'Account & Security',
    question: 'Is my data secure?',
    answer: 'Yes! We use AES-256-GCM encryption for all sensitive data (OAuth tokens, stream keys, API keys). All connections use HTTPS/TLS. Payment processing is handled securely by Stripe (PCI-compliant). We never store your credit card information.',
  },
  {
    category: 'Account & Security',
    question: 'How do I delete my account?',
    answer: 'Go to Settings → Account → Delete Account. This permanently deletes all your data including broadcasts, recordings, and uploaded media. This action cannot be undone. Active subscriptions are canceled automatically.',
  },
];

const categories = Array.from(new Set(faqData.map(item => item.category)));

export function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const filteredFAQ = faqData.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof item.answer === 'string' && item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === null || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link to="/" className="text-primary-500 hover:text-primary-400 font-semibold">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-gray-400 text-lg mb-8">
            Find answers to common questions about using Streamlick
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search for questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === null
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        {filteredFAQ.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No questions found matching your search.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory(null);
              }}
              className="mt-4 text-primary-500 hover:text-primary-400"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFAQ.map((item, index) => {
              const globalIndex = faqData.indexOf(item);
              const isExpanded = expandedItems.has(globalIndex);

              return (
                <div
                  key={globalIndex}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleItem(globalIndex)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1">
                      <span className="text-xs text-primary-500 font-medium mb-1 block">
                        {item.category}
                      </span>
                      <span className="text-white font-medium">{item.question}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-4 ${
                        isExpanded ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4 text-gray-300 border-t border-gray-700 pt-4">
                      {typeof item.answer === 'string' ? (
                        <p>{item.answer}</p>
                      ) : (
                        item.answer
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-12 bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Still have questions?</h2>
          <p className="text-gray-400 mb-6">
            Can't find what you're looking for? Our support team is here to help!
          </p>
          <a
            href="mailto:support@streamlick.com"
            className="inline-block px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
          >
            Contact Support
          </a>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-500 text-center">
            © 2024 Streamlick. All rights reserved. | <Link to="/terms" className="text-primary-500 hover:text-primary-400">Terms of Service</Link> | <Link to="/privacy" className="text-primary-500 hover:text-primary-400">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
