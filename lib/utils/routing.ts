// lib/utils/routing.ts
import { Role } from "@/types/roles";

export interface ApprovalRoute {
  firstApproverRole: "hod" | "registrar" | "principal";
  requiresPrincipalOverrideCheck: boolean;
}

export function determineApprover(roles: Role[], leaveType: string): ApprovalRoute {
  const isFaculty = roles.includes("faculty");
  const isLabAssistant = roles.includes("lab_assistant");
  const isOfficeStaff = roles.includes("office_staff");
  const isHeadClerk = roles.includes("head_clerk");
  const isHOD = roles.includes("hod");
  const isRegistrar = roles.includes("registrar");

  let firstApproverRole: "hod" | "registrar" | "principal" = "hod";

  if (isHOD && (isFaculty || isLabAssistant)) {
    firstApproverRole = "principal";
  } else if (isRegistrar && isOfficeStaff) {
    firstApproverRole = "principal";
  } else if (isOfficeStaff && isHeadClerk) {
    firstApproverRole = "registrar";
  } else if (isOfficeStaff) {
    firstApproverRole = "registrar";
  } else if (isFaculty || isLabAssistant) {
    firstApproverRole = "hod";
  } else {
    firstApproverRole = "hod";
  }

  const isOverrideEligibleType = ["CL", "EL", "ML"].includes(leaveType);
  const requiresPrincipalOverrideCheck = isOverrideEligibleType &&
    (firstApproverRole === "hod" || firstApproverRole === "registrar");

  return {
    firstApproverRole,
    requiresPrincipalOverrideCheck,
  };
}

export function getStatusForApprover(approverRole: "hod" | "registrar" | "principal"): LeaveStatus {
  switch (approverRole) {
    case "hod":
      return "Pending_HOD";
    case "registrar":
      return "Pending_Registrar";
    case "principal":
      return "Pending_Principal";
    default:
      return "Pending_HOD";
  }
}

// Import from types after they're defined
import { LeaveStatus } from "@/types/leave";