import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { broadcastService } from '../services/broadcast.service';
import { useAuthStore } from '../store/authStore';
import { useBranding } from '../context/BrandingContext';
import { Broadcast } from '../types';
import { API_URL } from '../services/api';
import toast from 'react-hot-toast';

// Platform icons for destination selection
const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', color: '#FF0000', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )},
  { id: 'twitch', name: 'Twitch', color: '#9146FF', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
    </svg>
  )},
  { id: 'facebook', name: 'Facebook', color: '#1877F2', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )},
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )},
  { id: 'x', name: 'X', color: '#000000', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )},
  { id: 'rumble', name: 'Rumble', color: '#85C742', icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
  )},
];

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'live' | 'recording' | 'webinar';
  onSubmit: (data: {
    title: string;
    isReusable: boolean;
    destinations: string[];
    source: 'studio' | 'prerecorded';
    type: 'live' | 'recording' | 'webinar';
    localRecordings?: boolean;
    recordingType?: 'audio-video' | 'audio-only';
  }) => void;
}

function CreateModal({ isOpen, onClose, type, onSubmit }: CreateModalProps) {
  const [source, setSource] = useState<'studio' | 'prerecorded'>('studio');
  const [isReusable, setIsReusable] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [localRecordings, setLocalRecordings] = useState(true);
  const [recordingType, setRecordingType] = useState<'audio-video' | 'audio-only'>('audio-video');

  const toggleDestination = (id: string) => {
    setSelectedDestinations(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    onSubmit({
      title: title || `New ${type === 'live' ? 'Live Stream' : type === 'recording' ? 'Recording' : 'Webinar'}`,
      isReusable,
      destinations: selectedDestinations,
      source,
      type,
      localRecordings,
      recordingType,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Webinar modal - Feature showcase
  if (type === 'webinar') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center pt-8 pb-4 px-6">
            <h2 className="text-2xl font-bold text-gray-900">Get Streamlick On-Air!</h2>
            <p className="text-gray-600 mt-2">
              Host a webinar, live stream, or event on Streamlick, or embed it on your website. Optionally, collect email addresses through a registration form.
            </p>
          </div>

          {/* Preview Image */}
          <div className="mx-6 rounded-xl overflow-hidden bg-gradient-to-br from-teal-600 to-teal-800 p-6">
            <div className="bg-gray-900/20 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white font-medium">Streamlick On Air</span>
            </div>
            <div className="mt-4 text-white">
              <p className="text-2xl font-bold">Go live with</p>
              <p className="text-3xl font-bold">Streamlick On-Air</p>
            </div>
          </div>

          {/* Features */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Advanced</h3>
            <p className="text-sm text-gray-500 mb-4">For professionals taking their content to the next level.</p>

            <ul className="space-y-2">
              {[
                'On-Air webinars',
                'Full HD (1080p)',
                '4K (2160p) local recordings',
                'Logos, Overlays, Video clips, Backgrounds',
                'Multistream - 8 destinations',
                'Unlimited streaming and recording',
                'and much more',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 space-y-3">
            <button
              onClick={handleSubmit}
              className="w-full py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Continue
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Show other plans
            </button>
            <p className="text-center text-sm text-green-600 flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Easy to cancel. No commitments.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Recording modal
  if (type === 'recording') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Create recording</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Recording Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recording title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your recording"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Local Recordings Toggle */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Local recordings</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setLocalRecordings(!localRecordings)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localRecordings ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localRecordings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {localRecordings && (
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordingType"
                      checked={recordingType === 'audio-video'}
                      onChange={() => setRecordingType('audio-video')}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Record audio and video</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordingType"
                      checked={recordingType === 'audio-only'}
                      onChange={() => setRecordingType('audio-only')}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Record audio only</span>
                  </label>
                </div>
              )}

              <p className="text-sm text-gray-500">
                The highest quality recordings with individual audio and video files for each participant, necessary for 4K Ultra HD.
              </p>
            </div>

            {/* Reusable Studio Toggle */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Reusable studio</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setIsReusable(!isReusable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isReusable ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isReusable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Live stream or record multiple times from the same studio and maintain the same link to share with your guests.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0">
            <button
              onClick={handleSubmit}
              className="w-full py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Create recording
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live stream modal (default)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create live stream</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Source Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Source</span>
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  checked={source === 'studio'}
                  onChange={() => setSource('studio')}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">Studio</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  checked={source === 'prerecorded'}
                  onChange={() => setSource('prerecorded')}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">Pre-recorded video</span>
                </div>
              </label>
            </div>
          </div>

          {/* Reusable Studio Toggle */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Reusable studio</span>
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setIsReusable(!isReusable)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isReusable ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isReusable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Live stream or record multiple times from the same studio and maintain the same link to share with your guests.
            </p>
          </div>

          {/* Destination Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Select destinations</h3>
            <div className="flex flex-wrap items-center gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => toggleDestination(platform.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    selectedDestinations.includes(platform.id)
                      ? 'ring-2 ring-primary-500 ring-offset-2'
                      : 'hover:bg-gray-100'
                  }`}
                  style={{
                    backgroundColor: selectedDestinations.includes(platform.id)
                      ? platform.color + '20'
                      : '#f3f4f6',
                    color: platform.color,
                  }}
                  title={platform.name}
                >
                  {platform.icon}
                </button>
              ))}

              <button
                className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
                title="Add destination"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <button
                onClick={() => setSelectedDestinations([])}
                className="text-sm text-gray-500 hover:text-gray-700 ml-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleSubmit}
            className="w-full py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Create live stream
          </button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [createModal, setCreateModal] = useState<{ isOpen: boolean; type: 'live' | 'recording' | 'webinar' }>({
    isOpen: false,
    type: 'live',
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { branding } = useBranding();

  useEffect(() => {
    loadBroadcasts();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBroadcasts = async () => {
    try {
      const data = await broadcastService.getAll();
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load broadcasts');
      setBroadcasts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = (type: 'live' | 'recording' | 'webinar') => {
    setCreateModal({ isOpen: true, type });
  };

  const handleCreateSubmit = async (data: {
    title: string;
    isReusable: boolean;
    destinations: string[];
    source: 'studio' | 'prerecorded';
    type: 'live' | 'recording' | 'webinar';
    localRecordings?: boolean;
    recordingType?: 'audio-video' | 'audio-only';
  }) => {
    try {
      // Backend expects individual fields: title, description, layout, backgroundColor, logoUrl, overlayText
      const broadcast = await broadcastService.create({
        title: data.title,
        description: '',
        layout: 'grid',
        backgroundColor: '#1a1a2e',
      });
      toast.success(`${data.type === 'live' ? 'Live stream' : data.type === 'recording' ? 'Recording' : 'Webinar'} created!`);
      navigate(`/studio/${broadcast.id}`);
    } catch (error) {
      toast.error('Failed to create broadcast');
    }
  };

  const deleteBroadcast = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await broadcastService.delete(id);
      setBroadcasts(broadcasts.filter(b => b.id !== id));
      toast.success('Broadcast deleted successfully');
      setActiveMenu(null);
    } catch (error) {
      toast.error('Failed to delete broadcast');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Create Modal */}
      <CreateModal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal({ ...createModal, isOpen: false })}
        type={createModal.type}
        onSubmit={handleCreateSubmit}
      />

      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo / Brand */}
        <div className="p-4 border-b border-gray-200">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${API_URL}${branding.logoUrl}`}
              alt={branding.config?.platformName || 'Logo'}
              className="h-10 object-contain cursor-pointer"
              onClick={() => navigate('/dashboard')}
            />
          ) : (
            <h1
              className="text-xl font-bold text-gray-900 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              {branding?.config?.platformName || 'Streamlick'}
            </h1>
          )}
          <p className="text-sm text-gray-500 mt-1">{user?.email?.split('@')[0] || 'User'}</p>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>

          <button
            onClick={() => navigate('/recordings')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Library
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Destinations
          </button>

          <button
            onClick={() => toast('Members feature coming soon!', { icon: '🚧' })}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Members
          </button>
        </nav>

        {/* Bottom Navigation */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => navigate('/analytics')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-end items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-600">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Create Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Live Stream Card */}
              <button
                onClick={() => openCreateModal('live')}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">Live stream</span>
              </button>

              {/* Recording Card */}
              <button
                onClick={() => openCreateModal('recording')}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">Recording</span>
              </button>

              {/* Webinar Card */}
              <button
                onClick={() => openCreateModal('webinar')}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">On-Air webinar</span>
              </button>
            </div>
          </section>

          {/* Reusable Studios Section */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Your Studios</h2>
              <button
                onClick={() => openCreateModal('live')}
                className="w-6 h-6 bg-primary-100 rounded flex items-center justify-center text-primary-600 hover:bg-primary-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No studios yet</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first studio to get started.</p>
                <button
                  onClick={() => openCreateModal('live')}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  Create Studio
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4">Studio name</div>
                  <div className="col-span-2">Last created</div>
                  <div className="col-span-1 text-center">Status</div>
                  <div className="col-span-2">Created</div>
                  <div className="col-span-3"></div>
                </div>

                {/* Table Rows */}
                {broadcasts.map((broadcast) => (
                  <div
                    key={broadcast.id}
                    className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 items-center"
                  >
                    {/* Studio Name */}
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-medium text-gray-900 truncate">{broadcast.title}</span>
                    </div>

                    {/* Last Created */}
                    <div className="col-span-2 text-sm text-gray-500">
                      {formatDate(broadcast.createdAt)}
                    </div>

                    {/* Status */}
                    <div className="col-span-1 text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          broadcast.status === 'live'
                            ? 'bg-red-100 text-red-800'
                            : broadcast.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : broadcast.status === 'error'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {broadcast.status}
                      </span>
                    </div>

                    {/* Created Date */}
                    <div className="col-span-2 text-sm text-gray-500">
                      {formatDate(broadcast.createdAt)}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/studio/${broadcast.id}`)}
                        className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        Enter studio
                      </button>

                      {/* 3-dot menu */}
                      <div className="relative" ref={activeMenu === broadcast.id ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === broadcast.id ? null : broadcast.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenu === broadcast.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/guest/${broadcast.id}`);
                                toast.success('Guest link copied!');
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              Invite guests
                            </button>

                            <button
                              onClick={() => {
                                const newTitle = window.prompt('Edit studio name:', broadcast.title);
                                if (newTitle && newTitle !== broadcast.title) {
                                  broadcastService.update(broadcast.id, { title: newTitle }).then(() => {
                                    loadBroadcasts();
                                    toast.success('Studio renamed');
                                  });
                                }
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Edit
                            </button>

                            <hr className="my-1 border-gray-200" />

                            <button
                              onClick={() => deleteBroadcast(broadcast.id, broadcast.title)}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete studio
                            </button>
                          </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Streams and Recordings Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Streams and recordings</h2>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-200 mb-4">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'upcoming'
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'past'
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                Past
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              {activeTab === 'upcoming' ? (
                <p>No upcoming streams scheduled</p>
              ) : (
                <p>No past streams yet</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
