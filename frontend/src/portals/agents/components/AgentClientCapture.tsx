import React, { useState } from 'react';
import { clientsApi } from '../../../shared/api/apiClient';
import { AFRICAN_REGIONS, COUNTRIES_BY_REGION, COUNTRY_BY_NAME } from '../../../shared/utils/africanCountries';

interface CaptureFormData {
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

const INITIAL_FORM: CaptureFormData = {
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

const inputClass = (hasError: boolean) =>
  `w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-red-400' : 'border-gray-300'
  }`;

export function AgentClientCapture() {
  const [form, setForm] = useState<CaptureFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<CaptureFormData>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<CaptureFormData> = {};
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof CaptureFormData]) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError(null);
    try {
      await clientsApi.createClient({
        name: form.name,
        email: form.email,
        phone: form.phone,
        status: 'active',
      });
      setSubmitted(true);
      setForm(INITIAL_FORM);
      setErrors({});
    } catch {
      setApiError('Failed to capture client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
        <div className="text-green-500 text-5xl">✓</div>
        <h3 className="text-xl font-semibold text-gray-800">Client Captured!</h3>
        <p className="text-gray-500">The new client has been added to your pipeline.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="w-full py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Capture Another Client
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Capture New Client</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="ag-name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ag-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Amara Diallo"
            className={inputClass(!!errors.name)}
            aria-describedby={errors.name ? 'ag-name-error' : undefined}
          />
          {errors.name && (
            <p id="ag-name-error" className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="ag-email" className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="ag-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="e.g. amara@company.com"
            className={inputClass(!!errors.email)}
            aria-describedby={errors.email ? 'ag-email-error' : undefined}
          />
          {errors.email && (
            <p id="ag-email-error" className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="ag-phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="ag-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="e.g. +221 77 123 4567"
            className={inputClass(!!errors.phone)}
            aria-describedby={errors.phone ? 'ag-phone-error' : undefined}
          />
          {errors.phone && (
            <p id="ag-phone-error" className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Country */}
        <div>
          <label htmlFor="ag-country" className="block text-sm font-medium text-gray-700 mb-2">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            id="ag-country"
            name="country"
            value={form.country}
            onChange={handleCountryChange}
            className={inputClass(!!errors.country)}
            aria-describedby={errors.country ? 'ag-country-error' : undefined}
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
            <p id="ag-country-error" className="mt-1 text-sm text-red-500">{errors.country}</p>
          )}
        </div>

        {/* Region (auto-filled) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
          <input type="text" readOnly value={form.region} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-500" />
        </div>

        {/* Currency (auto-filled) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
          <input type="text" readOnly value={form.currency ? `${form.currency} — ${form.currencyName}` : ''} className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-500" />
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="ag-industry" className="block text-sm font-medium text-gray-700 mb-2">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            id="ag-industry"
            name="industry"
            value={form.industry}
            onChange={handleChange}
            className={inputClass(!!errors.industry)}
            aria-describedby={errors.industry ? 'ag-industry-error' : undefined}
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
          {errors.industry && (
            <p id="ag-industry-error" className="mt-1 text-sm text-red-500">{errors.industry}</p>
          )}
        </div>

        {/* Service Description */}
        <div>
          <label htmlFor="ag-serviceDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Service Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="ag-serviceDescription"
            name="serviceDescription"
            value={form.serviceDescription}
            onChange={handleChange}
            rows={4}
            placeholder="Describe the services required..."
            className={`${inputClass(!!errors.serviceDescription)} resize-none`}
            aria-describedby={errors.serviceDescription ? 'ag-serviceDescription-error' : undefined}
          />
          {errors.serviceDescription && (
            <p id="ag-serviceDescription-error" className="mt-1 text-sm text-red-500">
              {errors.serviceDescription}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2 disabled:opacity-60"
        >
          {isSubmitting ? 'Capturing...' : 'Capture Client'}
        </button>
        {apiError && (
          <p className="mt-2 text-sm text-red-500 text-center" role="alert">{apiError}</p>
        )}
      </form>
    </div>
  );
}
