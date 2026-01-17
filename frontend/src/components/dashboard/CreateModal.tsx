import { useState } from 'react';
import { X, Video, Calendar } from 'lucide-react';

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
  { id: 'x', name: 'X', color: '#FFFFFF', icon: (
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

export type CreateType = 'live' | 'recording' | 'webinar';

interface CreateModalData {
  title: string;
  isReusable: boolean;
  destinations: string[];
  source: 'studio' | 'prerecorded';
  type: CreateType;
  localRecordings?: boolean;
  recordingType?: 'audio-video' | 'audio-only';
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: CreateType;
  onSubmit: (data: CreateModalData) => void;
  isLoading?: boolean;
}

export function CreateModal({ isOpen, onClose, type, onSubmit, isLoading }: CreateModalProps) {
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
  };

  const resetForm = () => {
    setTitle('');
    setSource('studio');
    setIsReusable(false);
    setSelectedDestinations([]);
    setLocalRecordings(true);
    setRecordingType('audio-video');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Webinar modal - Feature showcase
  if (type === 'webinar') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
        <div className="relative bg-dark-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-dark-700">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center pt-8 pb-4 px-6">
            <h2 className="text-2xl font-bold">Get Streamlick On-Air!</h2>
            <p className="text-dark-400 mt-2">
              Host a webinar, live stream, or event on Streamlick, or embed it on your website.
            </p>
          </div>

          {/* Preview Image */}
          <div className="mx-6 rounded-xl overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 p-6">
            <div className="bg-black/20 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
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
            <h3 className="text-lg font-semibold mb-1">Advanced</h3>
            <p className="text-sm text-dark-500 mb-4">For professionals taking their content to the next level.</p>

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
                <li key={i} className="flex items-center gap-2 text-sm text-dark-300">
                  <svg className="w-5 h-5 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
              disabled={isLoading}
              className="w-full py-3 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Continue'}
            </button>
            <button
              onClick={handleClose}
              className="w-full text-sm text-brand-400 hover:text-brand-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Recording modal
  if (type === 'recording') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
        <div className="relative bg-dark-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-dark-700">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-dark-800">
            <h2 className="text-xl font-semibold">Create recording</h2>
            <button
              onClick={handleClose}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Recording Title */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Recording title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your recording"
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Local Recordings Toggle */}
            <div className="bg-dark-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Local recordings</span>
                  <button className="text-dark-500 hover:text-dark-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setLocalRecordings(!localRecordings)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localRecordings ? 'bg-brand-600' : 'bg-dark-600'
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
                      className="w-4 h-4 text-brand-600 border-dark-600 focus:ring-brand-500 bg-dark-700"
                    />
                    <span className="text-sm text-dark-300">Record audio and video</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recordingType"
                      checked={recordingType === 'audio-only'}
                      onChange={() => setRecordingType('audio-only')}
                      className="w-4 h-4 text-brand-600 border-dark-600 focus:ring-brand-500 bg-dark-700"
                    />
                    <span className="text-sm text-dark-300">Record audio only</span>
                  </label>
                </div>
              )}

              <p className="text-sm text-dark-500">
                The highest quality recordings with individual audio and video files for each participant.
              </p>
            </div>

            {/* Reusable Studio Toggle */}
            <div className="bg-dark-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Reusable studio</span>
                  <button className="text-dark-500 hover:text-dark-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setIsReusable(!isReusable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isReusable ? 'bg-brand-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isReusable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-dark-500 mt-2">
                Record multiple times from the same studio and maintain the same link to share with your guests.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-3 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create recording'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live stream modal (default)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
      <div className="relative bg-dark-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-xl font-semibold">Create live stream</h2>
          <button
            onClick={handleClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Stream title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your live stream"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Source Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-dark-300">Source</span>
              <button className="text-dark-500 hover:text-dark-400">
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
                  className="w-4 h-4 text-brand-600 border-dark-600 focus:ring-brand-500 bg-dark-700"
                />
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-dark-400" />
                  <span className="text-sm text-dark-300">Studio</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  checked={source === 'prerecorded'}
                  onChange={() => setSource('prerecorded')}
                  className="w-4 h-4 text-brand-600 border-dark-600 focus:ring-brand-500 bg-dark-700"
                />
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-dark-400" />
                  <span className="text-sm text-dark-300">Pre-recorded video</span>
                </div>
              </label>
            </div>
          </div>

          {/* Reusable Studio Toggle */}
          <div className="bg-dark-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Reusable studio</span>
                <button className="text-dark-500 hover:text-dark-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setIsReusable(!isReusable)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isReusable ? 'bg-brand-600' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isReusable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-dark-500 mt-2">
              Live stream or record multiple times from the same studio and maintain the same link to share with your guests.
            </p>
          </div>

          {/* Destination Selection */}
          <div>
            <h3 className="text-sm font-medium text-dark-300 mb-3">Select destinations</h3>
            <div className="flex flex-wrap items-center gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => toggleDestination(platform.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    selectedDestinations.includes(platform.id)
                      ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-dark-900'
                      : 'hover:bg-dark-700'
                  }`}
                  style={{
                    backgroundColor: selectedDestinations.includes(platform.id)
                      ? platform.color + '30'
                      : '#374151',
                    color: platform.color,
                  }}
                  title={platform.name}
                >
                  {platform.icon}
                </button>
              ))}

              <button
                className="w-12 h-12 rounded-full border-2 border-dashed border-dark-600 flex items-center justify-center text-dark-500 hover:border-brand-500 hover:text-brand-500 transition"
                title="Add destination"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <button
                onClick={() => setSelectedDestinations([])}
                className="text-sm text-dark-500 hover:text-dark-400 ml-2"
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
            disabled={isLoading}
            className="w-full py-3 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create live stream'}
          </button>
        </div>
      </div>
    </div>
  );
}
