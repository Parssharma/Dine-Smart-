import React from 'react';
import CustomerPortal from '../../components/CustomerPortal';

/**
 * FindTablePage: Renders the CustomerPortal in 'reserve' mode.
 * Route: /reserve
 */
export default function FindTablePage() {
  return <CustomerPortal initialTab="reserve" />;
}
