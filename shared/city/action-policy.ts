/** Product decisions for the future authoritative world; local pilot permissions differ. */
export const ACTION_POLICY = {
  'register-profile': {
    scope: 'profile',
    history: false,
    permission: 'self',
    retry: 'receipt',
  },
  'set-profile': {
    scope: 'profile',
    history: false,
    permission: 'self',
    retry: 'receipt',
  },
  'mark-seen': {
    scope: 'private-profile',
    history: false,
    permission: 'self',
    retry: 'receipt',
  },
  'place-building': {
    scope: 'world',
    history: true,
    permission: 'citizen',
    retry: 'receipt',
  },
  'configure-modules': {
    scope: 'world',
    history: true,
    permission: 'additive-cooperation',
    retry: 'receipt',
  },
  'set-operating': {
    scope: 'world',
    history: true,
    permission: 'restart-or-creator',
    retry: 'receipt',
  },
  'set-billboard': {
    scope: 'world',
    history: true,
    permission: 'creator',
    retry: 'receipt',
  },
  'contribute-project': {
    scope: 'world',
    history: true,
    permission: 'citizen',
    retry: 'receipt',
  },
  'dispatch-metal': {
    scope: 'world',
    history: true,
    permission: 'citizen',
    retry: 'receipt',
  },
  'dispatch-metal-batch': {
    scope: 'world',
    history: true,
    permission: 'citizen',
    retry: 'receipt',
  },
  'production-tick': {
    scope: 'world',
    history: false,
    permission: 'server',
    retry: 'scheduled',
  },
  'terrain-reveal': {
    scope: 'derived-durable',
    history: false,
    permission: 'server',
    retry: 'parent-command',
  },
  'technology-unlock': {
    scope: 'derived-durable',
    history: true,
    permission: 'server',
    retry: 'parent-command',
  },
  'automatic-connections': {
    scope: 'derived',
    history: false,
    permission: 'server',
    retry: 'rebuild',
  },
  presence: {
    scope: 'ephemeral',
    history: false,
    permission: 'self',
    retry: 'replace',
  },
  'pedestrian-position': {
    scope: 'ephemeral',
    history: false,
    permission: 'self',
    retry: 'replace',
  },
  'enter-edit-mode': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  'leave-edit-mode': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  inspect: {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  'pan-zoom': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  'workshop-draft': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  forecast: {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  cancel: {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  'network-filter': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
  'guide-view': {
    scope: 'local',
    history: false,
    permission: 'local',
    retry: 'none',
  },
} as const;
export type PersistentCommandKind = {
  [
    K in keyof typeof ACTION_POLICY
  ]: (typeof ACTION_POLICY)[K]['retry'] extends 'receipt' ? K : never;
}[keyof typeof ACTION_POLICY];
