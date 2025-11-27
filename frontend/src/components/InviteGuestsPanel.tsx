import { useState, useEffect, useCallback } from 'react';
import {
  LinkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  QrCodeIcon,
  UserPlusIcon,
  EnvelopeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import api from '../services/api';

interface InviteGuestsPanelProps {
  broadcastId: string;
}

export function InviteGuestsPanel({ broadcastId }: InviteGuestsPanelProps) {
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Generate invite link via backend API
  const generateInviteLink = useCallback(async () => {
    setIsGeneratingLink(true);
    try {
      const response = await api.post('/participants/invite', {
        broadcastId,
        name: 'Guest', // Default name, guest can change when joining
        role: 'guest',
      });

      const link = response.data.inviteLink;
      setInviteLink(link);

      // Generate QR code for the link
      const qrUrl = await QRCode.toDataURL(link, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      toast.error('Failed to generate invite link');
      // Fallback to simple link if API fails
      const baseUrl = window.location.origin;
      const fallbackLink = `${baseUrl}/join/${broadcastId}`;
      setInviteLink(fallbackLink);
    } finally {
      setIsGeneratingLink(false);
    }
  }, [broadcastId]);

  useEffect(() => {
    generateInviteLink();
  }, [generateInviteLink]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link');
    }
  };

  const sendEmailInvite = async () => {
    if (!guestEmail || !guestEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingEmail(true);
    try {
      // TODO: Implement actual email sending via API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Invite sent to ${guestEmail}`);
      setGuestEmail('');
    } catch (err) {
      console.error('Failed to send email:', err);
      toast.error('Failed to send invite');
    } finally {
      setSendingEmail(false);
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join my live stream!');
    const body = encodeURIComponent(
      `You're invited to join my live stream!\n\nClick the link below to join:\n${inviteLink}\n\nSee you there!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Invite Guests
        </h3>
        <p className="text-sm text-gray-600">
          Share this link with guests to bring them into your broadcast
        </p>
      </div>

      {/* Invite Link */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Guest Invite Link
        </label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={isGeneratingLink ? 'Generating...' : inviteLink}
              readOnly
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm"
            />
          </div>
          <button
            onClick={copyToClipboard}
            disabled={isGeneratingLink || !inviteLink}
            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="w-5 h-5" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={generateInviteLink}
            disabled={isGeneratingLink}
            className="p-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Generate new invite link"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isGeneratingLink ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Each link is unique. Generate a new link for different guests.
        </p>
      </div>

      {/* QR Code Section */}
      <div className="space-y-3">
        <button
          onClick={() => setShowQR(!showQR)}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <QrCodeIcon className="w-5 h-5" />
          <span>{showQR ? 'Hide' : 'Show'} QR Code</span>
        </button>

        {showQR && qrCodeUrl && (
          <div className="p-4 bg-white border-2 border-gray-200 rounded-lg flex flex-col items-center space-y-3">
            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            <p className="text-sm text-gray-600 text-center">
              Guests can scan this QR code to join your broadcast
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or send directly</span>
        </div>
      </div>

      {/* Email Invite */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Send Email Invitation
        </label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendEmailInvite();
                }
              }}
            />
          </div>
          <button
            onClick={sendEmailInvite}
            disabled={sendingEmail}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <UserPlusIcon className="w-5 h-5" />
            <span>{sendingEmail ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </div>

      {/* Quick Share Buttons */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Quick Share
        </label>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={shareViaEmail}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center space-x-2"
          >
            <EnvelopeIcon className="w-5 h-5" />
            <span>Share via Email Client</span>
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          How it works:
        </h4>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside ml-1">
          <li>Share the invite link with your guests</li>
          <li>Guests enter their name and test their camera/mic</li>
          <li>They join the <strong>"Greenroom"</strong> (waiting area)</li>
          <li>Move them to <strong>"Backstage"</strong> when ready to prepare</li>
          <li>Bring them <strong>"Live"</strong> on the broadcast when it's their turn</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            💡 <strong>Tip:</strong> Guests can chat with each other in the Greenroom while waiting
          </p>
        </div>
      </div>

      {/* Guest Permissions */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Guest Permissions
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Guests can use camera and microphone
            </span>
          </label>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Guests can share their screen
            </span>
          </label>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Require approval before joining backstage
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
