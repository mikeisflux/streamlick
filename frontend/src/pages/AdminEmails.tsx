import { useState, useEffect } from 'react';
import {
  Mail,
  Inbox,
  Send,
  Plus,
  Trash2,
  Reply,
  Folder,
  Paperclip,
  X,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  Search
} from 'lucide-react';
import api from '../services/api';

interface Mailbox {
  id: string;
  name: string;
  email: string;
  type: string;
  isActive: boolean;
  createdAt: string;
}

interface Email {
  id: string;
  mailboxId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: any[];
  direction: string;
  status: string;
  isRead: boolean;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export function AdminEmails() {
  const [view, setView] = useState<'menu' | 'mailboxes' | 'mailroom'>('menu');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [showNewMailbox, setShowNewMailbox] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);

  const [newMailbox, setNewMailbox] = useState({
    name: '',
    email: '',
    password: '',
    type: 'sendgrid',
  });

  const [composeEmail, setComposeEmail] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
  });

  const [attachments, setAttachments] = useState<File[]>([]);

  // Load mailboxes
  const loadMailboxes = async () => {
    try {
      const response = await api.get('/emails/mailboxes');
      setMailboxes(response.data);
      if (response.data.length > 0 && !selectedMailbox) {
        setSelectedMailbox(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load mailboxes:', error);
    }
  };

  // Load emails
  const loadEmails = async () => {
    if (!selectedMailbox) return;

    setLoading(true);
    try {
      const response = await api.get('/emails', {
        params: {
          mailboxId: selectedMailbox,
          folder,
          limit: 100,
        },
      });
      setEmails(response.data);
    } catch (error) {
      console.error('Failed to load emails:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'mailboxes' || view === 'mailroom') {
      loadMailboxes();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'mailroom' && selectedMailbox) {
      loadEmails();
    }
  }, [view, selectedMailbox, folder]);

  const createMailbox = async () => {
    try {
      await api.post('/emails/mailboxes', newMailbox);
      setShowNewMailbox(false);
      setNewMailbox({ name: '', email: '', password: '', type: 'sendgrid' });
      loadMailboxes();
    } catch (error) {
      console.error('Failed to create mailbox:', error);
      alert('Failed to create mailbox');
    }
  };

  const deleteMailbox = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox?')) return;

    try {
      await api.delete(`/emails/mailboxes/${id}`);
      loadMailboxes();
    } catch (error) {
      console.error('Failed to delete mailbox:', error);
      alert('Failed to delete mailbox');
    }
  };

  const sendEmail = async () => {
    try {
      const formData = new FormData();
      formData.append('mailboxId', selectedMailbox || '');
      formData.append('to', composeEmail.to);
      formData.append('cc', composeEmail.cc);
      formData.append('subject', composeEmail.subject);
      formData.append('bodyText', composeEmail.body);
      formData.append('bodyHtml', composeEmail.body.replace(/\n/g, '<br>'));

      if (replyTo) {
        formData.append('inReplyTo', replyTo.id);
      }

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      await api.post('/emails', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowCompose(false);
      setReplyTo(null);
      setComposeEmail({ to: '', cc: '', subject: '', body: '' });
      setAttachments([]);
      loadEmails();
      alert('Email sent successfully!');
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email');
    }
  };

  const replyToEmail = (email: Email) => {
    setReplyTo(email);
    setComposeEmail({
      to: email.fromEmail,
      cc: '',
      subject: `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.fromEmail}\nSubject: ${email.subject}\n\n${email.bodyText}`,
    });
    setShowCompose(true);
  };

  const deleteEmail = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email?')) return;

    try {
      await api.delete(`/emails/${id}`);
      setSelectedEmail(null);
      loadEmails();
    } catch (error) {
      console.error('Failed to delete email:', error);
      alert('Failed to delete email');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Menu View
  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Email Management</h1>
            <p className="text-gray-400">Manage your mailboxes and emails</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setView('mailboxes')}
              className="bg-gray-800 border border-cyan-500/20 rounded-lg p-8 hover:bg-gray-750 hover:border-cyan-500/40 transition-all group"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20">
                  <Folder className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold">Mailboxes</h2>
              </div>
              <p className="text-gray-400 text-left">
                Create and manage email mailboxes
              </p>
            </button>

            <button
              onClick={() => setView('mailroom')}
              className="bg-gray-800 border border-purple-500/20 rounded-lg p-8 hover:bg-gray-750 hover:border-purple-500/40 transition-all group"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20">
                  <Mail className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold">Mailroom</h2>
              </div>
              <p className="text-gray-400 text-left">
                View, send, and manage emails
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mailboxes View
  if (view === 'mailboxes') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('menu')}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold">Mailboxes</h1>
                <p className="text-gray-400">Manage your email mailboxes</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewMailbox(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>New Mailbox</span>
            </button>
          </div>

          {/* Mailboxes List */}
          <div className="space-y-4">
            {mailboxes.map((mailbox) => (
              <div
                key={mailbox.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <Mail className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{mailbox.name || mailbox.email}</h3>
                    <p className="text-gray-400">{mailbox.email}</p>
                    <span className="text-xs text-gray-500">
                      {mailbox.type} • {mailbox.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMailbox(mailbox.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            {mailboxes.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No mailboxes yet. Create one to get started.
              </div>
            )}
          </div>

          {/* New Mailbox Modal */}
          {showNewMailbox && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">New Mailbox</h2>
                  <button
                    onClick={() => setShowNewMailbox(false)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={newMailbox.name}
                      onChange={(e) => setNewMailbox({ ...newMailbox, name: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                      placeholder="Support"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address *</label>
                    <input
                      type="email"
                      value={newMailbox.email}
                      onChange={(e) => setNewMailbox({ ...newMailbox, email: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                      placeholder="support@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <select
                      value={newMailbox.type}
                      onChange={(e) => setNewMailbox({ ...newMailbox, type: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="sendgrid">SendGrid</option>
                      <option value="smtp">SMTP</option>
                      <option value="imap">IMAP</option>
                    </select>
                  </div>

                  <div className="flex space-x-4 pt-4">
                    <button
                      onClick={createMailbox}
                      className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                    >
                      Create Mailbox
                    </button>
                    <button
                      onClick={() => setShowNewMailbox(false)}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mailroom View (Gmail-like)
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <button
              onClick={() => setView('menu')}
              className="flex items-center space-x-2 text-gray-400 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Compose</span>
            </button>
          </div>

          {/* Mailbox Selector */}
          <div className="p-4 border-b border-gray-700">
            <label className="block text-sm font-medium mb-2">Mailbox</label>
            <select
              value={selectedMailbox || ''}
              onChange={(e) => setSelectedMailbox(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none text-sm"
            >
              {mailboxes.map((mb) => (
                <option key={mb.id} value={mb.id}>
                  {mb.name || mb.email}
                </option>
              ))}
            </select>
          </div>

          {/* Folders */}
          <div className="flex-1 p-4">
            <button
              onClick={() => setFolder('inbox')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                folder === 'inbox'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'hover:bg-gray-700 text-gray-400'
              }`}
            >
              <Inbox className="w-5 h-5" />
              <span>Inbox</span>
            </button>

            <button
              onClick={() => setFolder('sent')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                folder === 'sent'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'hover:bg-gray-700 text-gray-400'
              }`}
            >
              <Send className="w-5 h-5" />
              <span>Sent</span>
            </button>
          </div>
        </div>

        {/* Email List */}
        <div className="w-96 bg-gray-850 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {folder === 'inbox' ? 'Inbox' : 'Sent'}
            </h2>
            <button
              onClick={loadEmails}
              className="p-2 hover:bg-gray-700 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors ${
                  selectedEmail?.id === email.id ? 'bg-gray-800' : ''
                } ${!email.isRead && folder === 'inbox' ? 'bg-cyan-500/5' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-sm truncate flex-1">
                    {folder === 'inbox' ? email.fromEmail : email.toEmail}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(email.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm font-medium mb-1 truncate">
                  {email.subject || '(No Subject)'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {email.bodyText?.substring(0, 100)}...
                </div>
                {!email.isRead && folder === 'inbox' && (
                  <div className="w-2 h-2 bg-cyan-500 rounded-full mt-2"></div>
                )}
              </div>
            ))}

            {emails.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                No emails in this folder
              </div>
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 bg-gray-900 flex flex-col">
          {selectedEmail ? (
            <>
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <h1 className="text-2xl font-bold flex-1">{selectedEmail.subject || '(No Subject)'}</h1>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => replyToEmail(selectedEmail)}
                      className="p-2 hover:bg-gray-800 rounded-lg"
                      title="Reply"
                    >
                      <Reply className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteEmail(selectedEmail.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">From:</span>
                    <span>{selectedEmail.fromEmail}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">To:</span>
                    <span>{selectedEmail.toEmail}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Date:</span>
                    <span>{new Date(selectedEmail.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <span>{selectedEmail.attachments.length} attachment(s)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-invert max-w-none">
                  {selectedEmail.bodyHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{selectedEmail.bodyText}</pre>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select an email to read
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold">
                {replyTo ? 'Reply' : 'New Message'}
              </h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  setReplyTo(null);
                  setComposeEmail({ to: '', cc: '', subject: '', body: '' });
                  setAttachments([]);
                }}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">To *</label>
                <input
                  type="email"
                  value={composeEmail.to}
                  onChange={(e) => setComposeEmail({ ...composeEmail, to: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">CC</label>
                <input
                  type="email"
                  value={composeEmail.cc}
                  onChange={(e) => setComposeEmail({ ...composeEmail, cc: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                  placeholder="cc@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subject *</label>
                <input
                  type="text"
                  value={composeEmail.subject}
                  onChange={(e) => setComposeEmail({ ...composeEmail, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message *</label>
                <textarea
                  value={composeEmail.body}
                  onChange={(e) => setComposeEmail({ ...composeEmail, body: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none min-h-[200px]"
                  placeholder="Write your message..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Attachments</label>
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-900 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Paperclip className="w-4 h-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center space-x-2 p-2 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500 transition-colors">
                    <Paperclip className="w-5 h-5" />
                    <span>Add Attachment</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex space-x-4">
              <button
                onClick={sendEmail}
                disabled={!composeEmail.to || !composeEmail.subject}
                className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                Send Email
              </button>
              <button
                onClick={() => {
                  setShowCompose(false);
                  setReplyTo(null);
                  setComposeEmail({ to: '', cc: '', subject: '', body: '' });
                  setAttachments([]);
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
