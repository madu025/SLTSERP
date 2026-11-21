import { redirect } from 'next/navigation';

// The check that makes a finished order ready for invoicing is done on the Completed SOD page (connection, material, photos).
export default function SodApprovalsRedirect() {
    redirect('/service-orders/work-order/completed?check=waiting');
}
