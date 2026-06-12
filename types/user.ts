import { Role } from "./roles";

export interface User {
  uid: string;
  employeeCode?: string;
  name: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  collegeId: string;
  collegeName: string;
  departmentId: string;
  departmentName: string;
  roles: Role[];
  status: "active" | "deleted";
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  restoredAt?: Date;
  restoredBy?: string;
  dateOfJoining?: Date;
  isEmployed: boolean;
  createdAt: Date;
  updatedAt: Date;
}