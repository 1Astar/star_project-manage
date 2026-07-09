export function canShareRoleUpdateTask(linkRole: string, taskRole: string): boolean {
  if (linkRole === "admin" || linkRole === "readonly") return linkRole === "admin";
  if (linkRole === "test") return false;
  return linkRole === taskRole;
}

export function canShareRoleUpdateAcceptance(linkRole: string): boolean {
  return linkRole === "test" || linkRole === "product" || linkRole === "admin";
}

export function canShareRoleComment(_linkRole: string): boolean {
  return true;
}

export function canShareRoleSubmitTest(linkRole: string): boolean {
  return linkRole === "test" || linkRole === "admin";
}
