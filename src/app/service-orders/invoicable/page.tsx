import { redirect } from 'next/navigation';

// The older "Invoicable SODs" page verified orders one contractor at a time. Invoices are now created from the orders that the Area
// Coordinator and QC Officer passed, on the Invoicing page.
export default function InvoicablePage() {
    redirect('/service-orders/invoicing');
}
