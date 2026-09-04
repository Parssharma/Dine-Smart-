// Navigation configuration for the Management Portal top nav.
// Flat array of navigation items (replaces grouped config).

export const NAV_ITEMS = [
  { label: 'Overview', view: 'dashboard', path: '/management' },
  { label: 'Floor Plan', view: 'floor', path: '/management/floor' },
  { label: 'Reservations', view: 'bookings', path: '/management/bookings' },
  { label: 'Waitlist', view: 'waitlist', path: '/management/waitlist' },
  { label: 'Tables', view: 'tables', path: '/management/tables' },
  { label: 'Performance', view: 'analytics', path: '/management/analytics' },
  { label: 'Activity', view: 'history', path: '/management/history' },
];
