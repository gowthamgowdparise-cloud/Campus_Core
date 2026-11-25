'use strict';

/**
 * Fine-grained permission constants and role-permission mappings.
 * Aligned with the Role-Permission Matrix in ARCHITECTURE.md and Prompt 2 requirements.
 */
const PERMISSIONS = Object.freeze({
  AUTH_READ_SELF               : 'auth:read_self',
  AUTH_CHANGE_PASSWORD         : 'auth:change_password',

  USERS_CREATE                 : 'users:create',
  USERS_READ                   : 'users:read',
  USERS_UPDATE                 : 'users:update',
  USERS_DELETE                 : 'users:delete',
  ROLES_READ                   : 'roles:read',

  STUDENTS_CREATE              : 'students:create',
  STUDENTS_READ                : 'students:read',
  STUDENTS_READ_OWN            : 'students:read_own',
  STUDENTS_UPDATE              : 'students:update',
  STUDENTS_DELETE              : 'students:delete',

  FACULTY_CREATE               : 'faculty:create',
  FACULTY_READ                 : 'faculty:read',
  FACULTY_UPDATE               : 'faculty:update',
  FACULTY_DELETE               : 'faculty:delete',

  DEPARTMENTS_MANAGE           : 'departments:manage',
  DEPARTMENTS_READ             : 'departments:read',

  PROGRAMS_MANAGE              : 'programs:manage',
  PROGRAMS_READ                : 'programs:read',

  ACADEMIC_YEARS_MANAGE        : 'academic_years:manage',
  ACADEMIC_YEARS_READ          : 'academic_years:read',

  ACADEMIC_CALENDAR_MANAGE     : 'academic_calendar:manage',
  ACADEMIC_CALENDAR_READ       : 'academic_calendar:read',

  SEMESTERS_MANAGE             : 'semesters:manage',
  SEMESTERS_READ               : 'semesters:read',

  SECTIONS_MANAGE              : 'sections:manage',
  SECTIONS_READ                : 'sections:read',

  COURSES_MANAGE               : 'courses:manage',
  COURSES_READ                 : 'courses:read',
  COURSE_ASSIGNMENTS_MANAGE    : 'course_assignments:manage',
  COURSE_ASSIGNMENTS_READ      : 'course_assignments:read',
  COURSE_MATERIALS_MANAGE      : 'course_materials:manage',
  COURSE_MATERIALS_READ        : 'course_materials:read',

  ENROLLMENTS_MANAGE           : 'enrollments:manage',
  ENROLLMENTS_READ             : 'enrollments:read',

  ATTENDANCE_MARK              : 'attendance:mark',
  ATTENDANCE_READ              : 'attendance:read',
  ATTENDANCE_CORRECTION_REQUEST: 'attendance:correction_request',
  ATTENDANCE_CORRECTION_APPROVE: 'attendance:correction_approve',

  EXAMINATIONS_MANAGE          : 'examinations:manage',
  EXAMINATIONS_READ            : 'examinations:read',

  ASSESSMENTS_MANAGE           : 'assessments:manage',
  ASSESSMENTS_READ             : 'assessments:read',

  MARKS_ENTER                  : 'marks:enter',
  MARKS_SUBMIT                 : 'marks:submit',
  MARKS_VERIFY                 : 'marks:verify',
  MARKS_READ                   : 'marks:read',
  MARKS_CORRECTION_REQUEST     : 'marks:correction_request',
  MARKS_CORRECTION_APPROVE     : 'marks:correction_approve',

  RESULTS_PUBLISH              : 'results:publish',
  RESULTS_READ                 : 'results:read',

  FEES_MANAGE                  : 'fees:manage',
  FEES_READ_OWN                : 'fees:read_own',

  PAYMENTS_MANAGE              : 'payments:manage',
  PAYMENTS_RECONCILE           : 'payments:reconcile',
  PAYMENTS_READ_OWN            : 'payments:read_own',

  TIMETABLES_MANAGE            : 'timetables:manage',
  TIMETABLES_READ              : 'timetables:read',

  ANNOUNCEMENTS_CREATE         : 'announcements:create',
  ANNOUNCEMENTS_MANAGE         : 'announcements:manage',
  ANNOUNCEMENTS_READ           : 'announcements:read',

  NOTIFICATIONS_READ           : 'notifications:read',
  NOTIFICATIONS_MANAGE         : 'notifications:manage',

  DOCUMENTS_UPLOAD             : 'documents:upload',
  DOCUMENTS_VERIFY             : 'documents:verify',
  DOCUMENTS_READ               : 'documents:read',

  GRIEVANCES_CREATE            : 'grievances:create',
  GRIEVANCES_MANAGE            : 'grievances:manage',
  GRIEVANCES_READ              : 'grievances:read',

  REPORTS_READ                 : 'reports:read',
  AUDIT_LOGS_READ              : 'audit_logs:read',
  SETTINGS_MANAGE              : 'settings:manage',
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const ROLE_PERMISSIONS = Object.freeze({
  admin: ALL_PERMISSIONS,

  faculty: [
    PERMISSIONS.AUTH_READ_SELF,
    PERMISSIONS.AUTH_CHANGE_PASSWORD,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.FACULTY_READ,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.PROGRAMS_READ,
    PERMISSIONS.ACADEMIC_YEARS_READ,
    PERMISSIONS.ACADEMIC_CALENDAR_READ,
    PERMISSIONS.SEMESTERS_READ,
    PERMISSIONS.SECTIONS_READ,
    PERMISSIONS.COURSES_READ,
    PERMISSIONS.COURSE_ASSIGNMENTS_READ,
    PERMISSIONS.COURSE_MATERIALS_MANAGE,
    PERMISSIONS.COURSE_MATERIALS_READ,
    PERMISSIONS.ENROLLMENTS_READ,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST,
    PERMISSIONS.ATTENDANCE_CORRECTION_APPROVE,
    PERMISSIONS.EXAMINATIONS_READ,
    PERMISSIONS.ASSESSMENTS_MANAGE,
    PERMISSIONS.ASSESSMENTS_READ,
    PERMISSIONS.MARKS_ENTER,
    PERMISSIONS.MARKS_SUBMIT,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_CORRECTION_REQUEST,
    PERMISSIONS.MARKS_CORRECTION_APPROVE,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.TIMETABLES_READ,
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.GRIEVANCES_CREATE,
    PERMISSIONS.GRIEVANCES_READ,
    PERMISSIONS.REPORTS_READ,
  ],

  student: [
    PERMISSIONS.AUTH_READ_SELF,
    PERMISSIONS.AUTH_CHANGE_PASSWORD,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.STUDENTS_READ_OWN,
    PERMISSIONS.DEPARTMENTS_READ,
    PERMISSIONS.PROGRAMS_READ,
    PERMISSIONS.ACADEMIC_YEARS_READ,
    PERMISSIONS.ACADEMIC_CALENDAR_READ,
    PERMISSIONS.SEMESTERS_READ,
    PERMISSIONS.SECTIONS_READ,
    PERMISSIONS.COURSES_READ,
    PERMISSIONS.COURSE_MATERIALS_READ,
    PERMISSIONS.ENROLLMENTS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST,
    PERMISSIONS.EXAMINATIONS_READ,
    PERMISSIONS.ASSESSMENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_CORRECTION_REQUEST,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.FEES_READ_OWN,
    PERMISSIONS.PAYMENTS_READ_OWN,
    PERMISSIONS.TIMETABLES_READ,
    PERMISSIONS.ANNOUNCEMENTS_READ,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.GRIEVANCES_CREATE,
    PERMISSIONS.GRIEVANCES_READ,
  ],
});

const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || [];

const hasPermission = (role, permission) => getPermissionsForRole(role).includes(permission);

const hasAllPermissions = (role, required = []) => {
  const granted = getPermissionsForRole(role);
  return required.every((p) => granted.includes(p));
};

const hasAnyPermission = (role, candidates = []) => {
  const granted = getPermissionsForRole(role);
  return candidates.some((p) => granted.includes(p));
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
};
