import { redirect } from 'next/navigation';

/** The petty cash page moved out of Finance so the custodian and the Area Manager of a site office reach it without the Finance menu. */
export default function PettyCashRedirectPage() {
    redirect('/petty-cash');
}
