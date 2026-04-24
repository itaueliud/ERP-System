export { clientService, ClientService } from './clientService';
export { default as clientRoutes } from './clientRoutes';
export { communicationService, CommunicationService } from './communicationService';
export { default as communicationRoutes } from './communicationRoutes';
export type {
  CreateClientInput,
  UpdateClientInput,
  Client,
} from './clientService';
export type {
  CreateCommunicationInput,
  Communication,
} from './communicationService';
export {
  ClientStatus,
  IndustryCategory,
  Priority,
} from './clientService';
export {
  CommunicationType,
} from './communicationService';
