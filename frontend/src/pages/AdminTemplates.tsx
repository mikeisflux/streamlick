import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Layout, Plus, Trash2, Copy, ArrowLeft, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description?: string;
  layout: number;
  settings: any;
  createdAt: string;
  usageCount?: number;
}

export function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    layout: 9,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/admin/templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Don't show error toast on initial load - just use empty array
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      await api.post('/admin/templates', {
        ...newTemplate,
        settings: {},
      });
      toast.success('Template created');
      setShowCreateModal(false);
      setNewTemplate({ name: '', description: '', layout: 9 });
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.delete(`/admin/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const duplicateTemplate = async (template: Template) => {
    try {
      await api.post('/admin/templates', {
        name: `${template.name} (Copy)`,
        description: template.description,
        layout: template.layout,
        settings: template.settings,
      });
      toast.success('Template duplicated');
      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-500/10 rounded-lg">
                <Layout className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Broadcast Templates</h1>
                <p className="text-gray-400">Create and manage reusable broadcast layouts</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Template
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-teal-500/20">
            <div className="text-gray-400 text-sm mb-1">Total Templates</div>
            <div className="text-3xl font-bold text-teal-400">{templates.length}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
            <div className="text-gray-400 text-sm mb-1">Total Usage</div>
            <div className="text-3xl font-bold text-blue-400">
              {templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/20">
            <div className="text-gray-400 text-sm mb-1">Most Popular</div>
            <div className="text-lg font-bold text-purple-400 truncate">
              {templates.length > 0
                ? templates.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0]?.name || '-'
                : '-'}
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <Layout className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No templates yet</h3>
            <p className="text-gray-400 mb-6">
              Create your first broadcast template to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="bg-gray-800 rounded-lg border border-gray-700 hover:border-teal-500/50 transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{template.name}</h3>
                      <p className="text-sm text-gray-400">
                        {template.description || 'No description'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Layout</span>
                      <span className="text-white">Layout {template.layout}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Used</span>
                      <span className="text-white">{template.usageCount || 0} times</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Created</span>
                      <span className="text-white">{formatDate(template.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => duplicateTemplate(template)}
                      className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors text-sm inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-md">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-white">Create Template</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., Interview Setup"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows={3}
                    placeholder="Describe this template..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Layout
                  </label>
                  <select
                    value={newTemplate.layout}
                    onChange={(e) => setNewTemplate({ ...newTemplate, layout: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((layout) => (
                      <option key={layout} value={layout}>
                        Layout {layout}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTemplate({ name: '', description: '', layout: 9 });
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createTemplate}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
