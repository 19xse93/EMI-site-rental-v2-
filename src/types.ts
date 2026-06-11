export interface Purchase {
  id: string; // PO Number
  prRequestor?: string;
  processorName?: string;
  prReceivedDate?: string;
  date: string;
  contractDate?: string;
  vendor: string;
  description: string;
  amount: number;
  grossAmount: number;
  discountAmount: number;
  paymentTerms: string;
  remarks?: string;
  attachmentData?: string | null;
  status?: 'Pending' | 'Invoiced' | 'Paid';
}

export interface APV {
  id: string; // APV Number
  poId: string;
  vendor: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  funded: boolean;
  fundedDate?: string | null;
  settledDate?: string | null;
  paymentTerms: string;
  status: 'Unpaid' | 'Paid';
  checkNumber?: string;
  checkDate?: string;
  releaseDate?: string | null;
  checkStatus?: 'Pending Check' | 'Check Created' | 'Collected';
}

export interface AppUser {
  id: string; // email
  email: string;
  name?: string;
  department?: string;
  accessLevels: number[];
  permissions?: UserPermissions;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface UserPermissions {
  viewPo: boolean;
  viewApv: boolean;
  viewTreasury: boolean;
  viewReports: boolean;
  managePo: boolean;
  manageApv: boolean;
  manageTreasury: boolean;
  deleteRecords: boolean;
  manageUsers: boolean;
  systemAdmin: boolean;
  exportData: boolean;
}
