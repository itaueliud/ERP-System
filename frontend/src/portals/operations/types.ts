export type NavSection =
  | 'overview'
  | 'clients'
  | 'leads'
  | 'pipeline'
  | 'properties'
  | 'communications';

export type LeadStage =
  | 'Prospect'
  | 'Lead'
  | 'Qualified_Lead'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed_Won'
  | 'Closed_Lost';

export type PropertyStatus = 'Available' | 'Under_Offer' | 'Sold' | 'Withdrawn';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  status: 'Active' | 'Inactive' | 'Prospect';
  assignedAgent: string;
  createdAt: string;
  country: string;
}

export interface Lead {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  stage: LeadStage;
  value: number;
  assignedAgent: string;
  createdAt: string;
  lastContact: string;
}

export interface Property {
  id: string;
  title: string;
  type: 'Residential' | 'Commercial' | 'Land' | 'Industrial';
  location: string;
  country: string;
  price: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  status: PropertyStatus;
  listedAt: string;
  agentName: string;
}

export interface Communication {
  id: string;
  clientId: string;
  clientName: string;
  type: 'Email' | 'Call' | 'Meeting' | 'SMS' | 'WhatsApp';
  subject: string;
  content: string;
  sentAt: string;
  sentBy: string;
}

export interface OperationsMetricsSummary {
  totalClients: number;
  activeLeads: number;
  pipelineValue: number;
  propertiesListed: number;
  closedWonThisMonth: number;
  conversionRate: number;
}
