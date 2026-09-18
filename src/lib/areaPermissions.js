/**
 * src/lib/areaPermissions.js
 * Centralized Area segregation logic for CIMA Law Firm.
 * Areas:
 * - Penal / Legal: fcdcad10-fc0d-4cd0-8a43-46de22c9b074
 * - Blindaje Legal Preventivo (BLP): 0ef8432e-1b5f-4030-8613-7cb0b3605432
 * - Global leadership: Admin, Dirección General (or null area_id / can_view_all_cases).
 */

export const PENAL_AREA_ID = "fcdcad10-fc0d-4cd0-8a43-46de22c9b074";
export const BLP_AREA_ID = "0ef8432e-1b5f-4030-8613-7cb0b3605432";

/**
 * Checks if the user has global/cross-area permissions (Admin or Dirección General).
 */
export function isUserGlobalAdmin(profile, permissions) {
  if (permissions?.can_view_all_cases) return true;
  const role = (profile?.role || "").trim().toLowerCase();
  if (role === "admin" || role === "direccion general") return true;
  return false;
}

/**
 * Normalizes an area name or id to identify if it is Penal or BLP.
 */
export function getAreaCategory(areaIdOrName) {
  if (!areaIdOrName) return null;
  const val = String(areaIdOrName).toLowerCase();
  if (val === PENAL_AREA_ID.toLowerCase() || val.includes("penal") || val.includes("legal")) {
    return "penal";
  }
  if (val === BLP_AREA_ID.toLowerCase() || val.includes("blindaje") || val.includes("preventivo") || val.includes("blp")) {
    return "blp";
  }
  return null;
}

/**
 * Determines the area category of a team member or lawyer based on:
 * 1. Their explicit area_id
 * 2. Their email (e.g. .penal@ or .blp@ or @prueba)
 * 3. Their role (e.g. senior/junior/servicio social -> penal; operativa/preventiva/auxiliar legal -> blp)
 * 4. Admin / Dirección General -> 'global'
 */
export function getMemberAreaCategory(member) {
  if (!member) return null;
  const roleLower = (member.role || "").trim().toLowerCase();
  if (roleLower === "admin" || roleLower === "direccion general") {
    return "global";
  }

  if (member.area_id) {
    const cat = getAreaCategory(member.area_id);
    if (cat) return cat;
  }

  const emailLower = (member.email || "").toLowerCase();
  if (emailLower.includes(".blp") || emailLower.includes("blindaje")) return "blp";
  if (
    emailLower.includes(".penal") ||
    emailLower.includes("penal") ||
    emailLower.includes("romeror") ||
    emailLower.includes("avila")
  ) {
    return "penal";
  }

  if (["operativa", "litigio estrategico", "auxiliar legal", "operacion preventiva"].some(r => roleLower.includes(r))) {
    return "blp";
  }
  if (["senior", "junior", "servicio social"].some(r => roleLower.includes(r))) {
    return "penal";
  }

  // Specific hardcoded checks for known team members
  const nameLower = (member.full_name || "").toLowerCase();
  if (["dulce", "alejandro", "samara", "nury"].some(n => nameLower.includes(n))) {
    return "blp";
  }
  if (["mirna", "ithan", "emmanuel razo", "alma aleida"].some(n => nameLower.includes(n))) {
    return "penal";
  }

  return null;
}

/**
 * Filter team members visible to a specific user.
 * - Global admin sees all members.
 * - Penal users see Penal members + Global admin members.
 * - BLP users see BLP members + Global admin members.
 */
export function filterMembersByArea(members = [], userProfile, permissions) {
  if (!members || !members.length) return [];
  if (isUserGlobalAdmin(userProfile, permissions)) return members;

  const userCat = getMemberAreaCategory(userProfile) || getAreaCategory(userProfile?.area_id);
  if (!userCat) {
    return members;
  }

  return members.filter(m => {
    const mCat = getMemberAreaCategory(m);
    if (mCat === "global") return true; // Admins are visible to both
    return mCat === userCat;
  });
}

/**
 * Determines if a given resource (event, task, document, case, client)
 * is visible to the logged-in user according to their area.
 */
export function isResourceInUserArea(resource, userProfile, { cases = [], members = [] } = {}, permissions) {
  if (!resource) return false;
  if (isUserGlobalAdmin(userProfile, permissions)) return true;

  const userCat = getMemberAreaCategory(userProfile) || getAreaCategory(userProfile?.area_id);
  if (!userCat) {
    return true;
  }

  // 1. If resource has explicit area_id
  if (resource.area_id) {
    const resCat = getAreaCategory(resource.area_id);
    if (resCat) return resCat === userCat;
  }

  // 2. If resource has case_id, look up the parent case's area
  if (resource.case_id) {
    const parentCase = cases.find(c => c.id === resource.case_id);
    if (parentCase) {
      const caseCat = getAreaCategory(parentCase.area_id);
      if (caseCat) return caseCat === userCat;
    }
  }

  // 3. Heuristic for events/tasks/documents without case_id:
  // Check assigned lawyer(s) or lawyer field
  const assignedList = [];
  if (Array.isArray(resource.assigned_lawyers)) {
    assignedList.push(...resource.assigned_lawyers);
  } else if (resource.assigned_lawyers) {
    assignedList.push(resource.assigned_lawyers);
  }
  if (resource.assigned_lawyer) {
    if (Array.isArray(resource.assigned_lawyer)) assignedList.push(...resource.assigned_lawyer);
    else assignedList.push(resource.assigned_lawyer);
  }
  if (resource.lawyer) {
    assignedList.push(resource.lawyer);
  }

  // Clean strings
  const cleanAssigned = assignedList
    .map(name => typeof name === "string" ? name.trim() : "")
    .filter(Boolean);

  if (cleanAssigned.length > 0) {
    let hasMatchingLawyer = false;
    let hasDifferentAreaLawyer = false;

    for (const lawyerName of cleanAssigned) {
      const matchedMember = members.find(m => 
        m.full_name?.toLowerCase() === lawyerName.toLowerCase() ||
        lawyerName.toLowerCase().includes(m.full_name?.toLowerCase() || "___") ||
        (m.email && lawyerName.toLowerCase() === m.email.toLowerCase())
      );

      if (matchedMember) {
        const mCat = getMemberAreaCategory(matchedMember);
        if (mCat === "global") {
          hasMatchingLawyer = true;
        } else if (mCat === userCat) {
          hasMatchingLawyer = true;
        } else if (mCat) {
          hasDifferentAreaLawyer = true;
        }
      } else {
        const nameLower = lawyerName.toLowerCase();
        if (nameLower.includes("blp") || nameLower.includes("preventivo")) {
          if (userCat === "blp") hasMatchingLawyer = true;
          else hasDifferentAreaLawyer = true;
        } else if (nameLower.includes("penal")) {
          if (userCat === "penal") hasMatchingLawyer = true;
          else hasDifferentAreaLawyer = true;
        }
      }
    }

    if (hasMatchingLawyer) return true;
    if (hasDifferentAreaLawyer) return false;
  }

  // 4. Check description or title heuristics for known entities
  const titleAndDesc = `${resource.title || ""} ${resource.description || ""}`.toLowerCase();
  if (
    titleAndDesc.includes("pegaduro") ||
    titleAndDesc.includes("cecol") ||
    titleAndDesc.includes("ana suáres") ||
    titleAndDesc.includes("ana suarez")
  ) {
    return userCat === "blp";
  }
  if (
    titleAndDesc.includes("javier breña") ||
    titleAndDesc.includes("villazan") ||
    titleAndDesc.includes("margaritas") ||
    titleAndDesc.includes("audiencia de control")
  ) {
    return userCat === "penal";
  }

  // 5. If created by current user
  if (resource.user_id && userProfile?.id && resource.user_id === userProfile.id) {
    return true;
  }

  // Default: do not leak cross-area
  return false;
}
