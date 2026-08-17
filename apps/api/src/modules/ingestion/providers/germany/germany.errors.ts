export class GermanyProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GermanyProviderConfigurationError';
  }
}
