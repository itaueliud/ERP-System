import React, { useState } from 'react';
import { AFRICAN_REGIONS, COUNTRIES_BY_REGION, COUNTRY_BY_NAME } from '../../../shared/utils/africanCountries';

interface ClientCaptureFormData {
  name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  currency: string;
  currencyName: string;
  industry: string;
  serviceDescription: string;
}

const INITIAL_FORM: ClientCaptureFormData = {
  name: '',
  email: '',
  phone: '',
  country: '',
  region: '',
  currency: '',
  currencyName: '',
  industry: '',
  serviceDescription: '',
};

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Real Estate',
  'Logistics',
  'Retail',
  'Manufacturing',
  'Education',
  'Oil & Gas',
  'Other',
];

interface ClientCaptureFormProps {
  onClose?: () => void;
}

export function ClientCaptureForm({ onClose }: ClientCaptureFormProps) {
  const [form, setForm] = useState<ClientCaptureFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<ClientCaptureFormData>>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<ClientCaptureFormData> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.phone.trim()) newErrors.phone = 'Phone is required';
    if (!form.country.trim()) newErrors.country = 'Country is required';
    if (!form.industry) newErrors.industry = 'Industry is required';
    if (!form.serviceDescription.trim()) newErrors.serviceDescription = 'Service description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ClientCaptureFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    const info = COUNTRY_BY_NAME[name];
    setForm(prev => ({
      ...prev,
      country: name,
      region: info?.region ?? '',
      currency: info?.currency ?? '',
      currencyName: info?.currencyName ?? '',
    }));
    if (errors.country) {
      setErrors(prev => ({ ...prev, country: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    console.log('New client captured:', form);
    setSubmitted(true);
    setForm(INITIAL_FORM);
    setErrors({});
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center space-y-4">
        <div className="text-green-600 text-4xl">✓</div>
        <h3 className="text-lg font-semibold text-gray-800">Client Captured Successfully</h3>
        <p className="text-sm text-gray-500">The new client has been added to the system.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Another Client
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Capture New Client</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close form"
          >
            ×
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="cc-name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="cc-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Amara Diallo"
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.name ? 'cc-name-error' : undefined}
          />
          {errors.name && (
            <p id="cc-name-error" className="mt-1 text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="cc-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="cc-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="e.g. amara@company.com"
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.email ? 'cc-email-error' : undefined}
          />
          {errors.email && (
            <p id="cc-email-error" className="mt-1 text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="cc-phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="cc-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="e.g. +221 77 123 4567"
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.phone ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.phone ? 'cc-phone-error' : undefined}
          />
          {errors.phone && (
            <p id="cc-phone-error" className="mt-1 text-xs text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Country */}
        <div>
          <label htmlFor="cc-country" className="block text-sm font-medium text-gray-700 mb-1">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            id="cc-country"
            name="country"
            value={form.country}
            onChange={handleCountryChange}
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.country ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.country ? 'cc-country-error' : undefined}
          >
            <option value="">Select country...</option>
            {AFRICAN_REGIONS.map(region => (
              <optgroup key={region} label={region}>
                {COUNTRIES_BY_REGION[region].map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.country && (
            <p id="cc-country-error" className="mt-1 text-xs text-red-500">{errors.country}</p>
          )}
        </div>

        {/* Region (auto-filled) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
          <input type="text" readOnly value={form.region} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500" />
        </div>

        {/* Currency (auto-filled) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <input type="text" readOnly value={form.currency ? `${form.currency} — ${form.currencyName}` : ''} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500" />
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="cc-industry" className="block text-sm font-medium text-gray-700 mb-1">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            id="cc-industry"
            name="industry"
            value={form.industry}
            onChange={handleChange}
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.industry ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.industry ? 'cc-industry-error' : undefined}
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
          {errors.industry && (
            <p id="cc-industry-error" className="mt-1 text-xs text-red-500">{errors.industry}</p>
          )}
        </div>

        {/* Service Description */}
        <div>
          <label htmlFor="cc-serviceDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Service Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cc-serviceDescription"
            name="serviceDescription"
            value={form.serviceDescription}
            onChange={handleChange}
            rows={3}
            placeholder="Describe the services required..."
            className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              errors.serviceDescription ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-describedby={errors.serviceDescription ? 'cc-serviceDescription-error' : undefined}
          />
          {errors.serviceDescription && (
            <p id="cc-serviceDescription-error" className="mt-1 text-xs text-red-500">{errors.serviceDescription}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Capture Client
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
