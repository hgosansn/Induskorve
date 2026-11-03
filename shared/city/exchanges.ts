/** Resources are conserved quantities; utilities and transport are capacities. */
export const RESOURCES = {
  metal: { label: 'Metal', unit: 'metal', conserved: true },
} as const;
export type ResourceId = keyof typeof RESOURCES;
export const EXCHANGES = {
  power: { label: 'Electricity', category: 'utility', unit: 'power units' },
  materials: {
    label: 'Metal logistics',
    category: 'transport',
    unit: 'connections',
  },
  heat: {
    label: 'Recovered heat',
    category: 'utility',
    unit: 'metal / cycle bonus',
  },
} as const;
export type ExchangeId = keyof typeof EXCHANGES;
export interface ExchangePort {
  id: string;
  exchange: ExchangeId;
  direction: 'input' | 'output';
  resource?: ResourceId;
}
export function compatiblePorts(output: ExchangePort, input: ExchangePort) {
  return (
    output.direction === 'output' &&
    input.direction === 'input' &&
    output.exchange === input.exchange &&
    output.resource === input.resource
  );
}
