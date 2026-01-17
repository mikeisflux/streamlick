import { useState, useEffect } from 'react';
import { Button } from '../Button';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface StudioTemplate {
  id: string;
  name: string;
  config: any;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function TemplatesSettings() {
  const [templates, setTemplates] = useState<StudioTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/templates/${id}`);
      toast.success('Template deleted');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/templates/${id}`, { isDefault: true });
      toast.success('Default template updated');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to update default template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Studio Templates</h2>
          <p className="text-gray-600">Save and reuse your studio configurations</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Template</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
          <p className="mt-1 text-sm text-gray-500">
            Save your studio layouts and settings as templates for quick reuse.
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowCreateModal(true)}>+ Create Template</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-2xl">
                  📋
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    {template.isDefault && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!template.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(template.id)}>
                    Set as Default
                  </Button>
                )}
                <Button variant="ghost" size="sm">
                  Preview
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(template.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

interface CreateTemplateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTemplateModal({ onClose, onSuccess }: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // In production, this would capture the current studio config
      const config = {
        layout: { type: 'grid', participants: [] },
        branding: {},
        overlays: [],
      };

      await api.post('/templates', {
        name,
        config,
        isDefault,
      });
      toast.success('Template created successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to create template');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Create Template</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Podcast Template"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded text-primary-600"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700">
              Set as default template
            </label>
          </div>

          <p className="text-sm text-gray-500">
            This will save your current studio layout, branding, and settings.
          </p>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
