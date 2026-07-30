export interface Site {
  id: string;
  name: string;
  code: string;
  location: {
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    lat: number;
    lng: number;
  };
  contact_person: string;
  phone: string;
  email: string;
  manager_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  vehicle_pool_capacity: number;
  created_at: Date;
  updated_at: Date;
}