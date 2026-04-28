import { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

interface Property {
  id: string;
  referenceNumber: string;
  title: string;
  location: string;
  country: string;
  propertyType: string;
  price: number;
  currency: string;
  size: number;
  status: string;
  viewCount: number;
  createdAt: string;
}

interface PropertyImage {
  id: string;
  url: string;
  displayOrder: number;
}

export default function PropertyManagement({ themeHex }: { themeHex: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', location: '', country: 'Kenya',
    price: '', currency: 'KES', propertyType: 'RESIDENTIAL', size: ''
  });
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/properties');
      setProperties(res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { loadProperties(); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.location || !form.price || !form.size) {
      setMsgOk(false); setMsg('All fields are required'); return;
    }
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/properties', {
        ...form,
        price: parseFloat(form.price),
        size: parseFloat(form.size)
      });
      setMsgOk(true); setMsg('Property created successfully!');
      setForm({ title: '', description: '', location: '', country: 'Kenya', price: '', currency: 'KES', propertyType: 'RESIDENTIAL', size: '' });
      setShowForm(false);
      loadProperties();
    } catch (err: any) {
      setMsgOk(false); setMsg(err?.response?.data?.error || 'Failed to create property');
    }
  };

  const loadImages = async (propertyId: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get(`/api/v1/properties/${propertyId}/images`);
      setImages(res.data?.images || res.data?.data || res.data || []);
    } catch { /* silent */ }
  };

  const handleImageUpload = async (propertyId: string, file: File) => {
    setUploadingImage(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const formData = new FormData();
      formData.append('image', file);
      await apiClient.post(`/api/v1/properties/${propertyId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadImages(propertyId);
      setMsg('Image uploaded successfully!');
      setMsgOk(true);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Failed to upload image');
      setMsgOk(false);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (propertyId: string, imageId: string) => {
    if (!confirm('Delete this image?')) return;
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.delete(`/api/v1/properties/${propertyId}/images/${imageId}`);
      loadImages(propertyId);
    } catch { /* silent */ }
  };

  return (
    <div>
      <SectionHeader
        title="Property Management"
        subtitle="Manage property listings"
        action={
          <PortalButton color={themeHex} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Property'}
          </PortalButton>
        }
      />

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
          {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${msgOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location *</label>
              <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Country *</label>
              <input type="text" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Type *</label>
              <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="LAND">Land</option>
                <option value="INDUSTRIAL">Industrial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Size (sq m) *</label>
              <input type="number" min="0" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Price *</label>
              <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency *</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <PortalButton color={themeHex} fullWidth onClick={handleSubmit}>Create Property</PortalButton>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading properties...</p>
      ) : (
        <>
          <DataTable
            columns={[
              { key: 'referenceNumber', label: 'Ref #' },
              { key: 'title', label: 'Title' },
              { key: 'location', label: 'Location' },
              { key: 'country', label: 'Country' },
              { key: 'propertyType', label: 'Type' },
              { key: 'price', label: 'Price', render: (v, r: any) => `${r.currency} ${Number(v).toLocaleString()}` },
              { key: 'size', label: 'Size (sq m)' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'AVAILABLE'} /> },
              { key: 'viewCount', label: 'Views' },
              { key: 'id', label: 'Actions', render: (id) => (
                <PortalButton size="sm" color={themeHex} onClick={() => { setSelectedProperty(id); loadImages(id); }}>
                  Manage Images
                </PortalButton>
              )},
            ]}
            rows={properties}
            emptyMessage="No properties found"
          />

          {selectedProperty && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Property Images</h3>
                  <button onClick={() => setSelectedProperty(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(selectedProperty, file);
                      }}
                      disabled={uploadingImage}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
                    />
                    {uploadingImage && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {images.map((img) => (
                      <div key={img.id} className="relative group">
                        <img src={img.url} alt="" className="w-full h-40 object-cover rounded-lg" />
                        <button
                          onClick={() => handleDeleteImage(selectedProperty, img.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  {images.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No images uploaded yet</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
