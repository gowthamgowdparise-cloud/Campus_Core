'use strict';

const standardErrors = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  422: { $ref: '#/components/responses/ValidationError' },
};

const op = (tag, summary, roles = ['admin', 'faculty', 'student'], opts = {}) => ({
  tags       : [tag],
  summary,
  description: `${opts.description || summary} — Allowed role(s): ${roles.join(', ')}${opts.permission ? ` (Permission: \`${opts.permission}\`)` : ''}.`,
  security   : opts.public ? [] : [{ BearerAuth: [] }],
  ...(opts.parameters ? { parameters: opts.parameters } : {}),
  ...(opts.requestBody ? { requestBody: opts.requestBody } : {}),
  responses  : {
    [opts.status || 200]: {
      description: opts.successDesc || 'Operation successful',
      content    : { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } },
    },
    ...(opts.public ? {} : standardErrors),
  },
});

const idParam = (name = 'id', desc = 'MongoDB ObjectId') => ({
  name,
  in      : 'path',
  required: true,
  schema  : { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  description: desc,
});

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
  { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Escaped case-insensitive text search' },
];

const jsonBody = (properties, required = []) => ({
  required: true,
  content : {
    'application/json': {
      schema: {
        type: 'object',
        ...(required.length ? { required } : {}),
        properties,
      },
    },
  },
});

const multipartFileBody = (properties, required = []) => ({
  required: true,
  content : {
    'multipart/form-data': {
      schema: {
        type    : 'object',
        required: ['file', ...required],
        properties: {
          file: { type: 'string', format: 'binary', description: 'Accepted types: .pdf, .png, .jpg, .jpeg, .webp, .docx, .pptx, .xlsx, .txt (validated by extension, MIME, and magic bytes)' },
          ...properties,
        },
      },
    },
  },
});

const openApiSpec = {
  openapi: '3.0.3',
  info   : {
    title      : 'CAMPUSCORE — College ERP & Student Information Management System API',
    version    : '1.0.0',
    description: 'Production-oriented backend-only REST API for CAMPUSCORE supporting ADMIN, FACULTY, and STUDENT roles, transactional MongoDB operations, file storage abstraction, payment provider/webhook verification, and configurable institutional policies.',
  },
  servers: [
    { url: '/', description: 'Current server base URL' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type        : 'http',
        scheme      : 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      SuccessEnvelope: {
        type      : 'object',
        properties: {
          status : { type: 'string', example: 'success' },
          message: { type: 'string' },
          data   : { type: 'object', additionalProperties: true },
          meta   : { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      PaginationMeta: {
        type      : 'object',
        properties: {
          page      : { type: 'integer', example: 1 },
          limit     : { type: 'integer', example: 20 },
          total     : { type: 'integer', example: 45 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      ErrorEnvelope: {
        type      : 'object',
        properties: {
          status   : { type: 'string', enum: ['fail', 'error'] },
          message  : { type: 'string' },
          requestId: { type: 'string' },
          details  : {
            type : 'array',
            items: {
              type      : 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
    responses: {
      BadRequest     : { description: 'Bad Request / Business Rule Violation', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Unauthorized   : { description: 'Authentication required or invalid/expired token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Forbidden      : { description: 'Insufficient role, permission, or resource ownership', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      NotFound       : { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      ValidationError: { description: 'Request input validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
    },
  },
  paths: {
    '/health': { get: op('Health & Docs', 'Readiness health check (DB connectivity)', ['public'], { public: true }) },
    '/health/live': { get: op('Health & Docs', 'Liveness health check', ['public'], { public: true }) },
    '/health/ready': { get: op('Health & Docs', 'Readiness probe checking MongoDB', ['public'], { public: true }) },
    '/api/v1/health': { get: op('Health & Docs', 'Versioned readiness check', ['public'], { public: true }) },
    '/api/v1/docs.json': { get: op('Health & Docs', 'Raw OpenAPI 3.0 specification JSON', ['public'], { public: true }) },

    '/api/v1/auth/login': {
      post: op('Auth', 'Authenticate active user and issue JWT + httpOnly refresh cookie', ['public'], {
        public: true,
        requestBody: jsonBody({ email: { type: 'string', format: 'email' }, password: { type: 'string' } }, ['email', 'password']),
      }),
    },
    '/api/v1/auth/refresh': { post: op('Auth', 'Rotate refresh token with family reuse detection', ['public'], { public: true }) },
    '/api/v1/auth/me': { get: op('Auth', 'Get authenticated user profile & permissions', ['admin', 'faculty', 'student'], { permission: 'auth:read_self' }) },
    '/api/v1/auth/logout': { post: op('Auth', 'Revoke current refresh token and clear cookie') },
    '/api/v1/auth/logout-all': { post: op('Auth', 'Revoke all active sessions across devices') },
    '/api/v1/auth/change-password': {
      patch: op('Auth', 'Change password and invalidate prior tokens', ['admin', 'faculty', 'student'], {
        permission: 'auth:change_password',
        requestBody: jsonBody({ currentPassword: { type: 'string' }, newPassword: { type: 'string' }, confirmPassword: { type: 'string' } }, ['currentPassword', 'newPassword', 'confirmPassword']),
      }),
    },

    '/api/v1/users/roles/permissions': { get: op('Users', 'List roles and permission matrix', ['admin', 'faculty', 'student'], { permission: 'roles:read' }) },
    '/api/v1/users': {
      get : op('Users', 'List users', ['admin'], { permission: 'users:read', parameters: paginationParams }),
      post: op('Users', 'Create user', ['admin'], { status: 201, permission: 'users:create' }),
    },
    '/api/v1/users/{id}': {
      get   : op('Users', 'Get user by ID (owner or admin)', ['admin', 'faculty', 'student'], { parameters: [idParam()] }),
      patch : op('Users', 'Update user profile (owner or admin)', ['admin', 'faculty', 'student'], { parameters: [idParam()] }),
      delete: op('Users', 'Soft-delete user', ['admin'], { permission: 'users:delete', parameters: [idParam()] }),
    },
    '/api/v1/users/{id}/status': { patch: op('Users', 'Update account status (active/inactive/suspended)', ['admin'], { permission: 'users:update', parameters: [idParam()] }) },
    '/api/v1/users/{id}/role': { patch: op('Users', 'Update user role and revoke active tokens', ['admin'], { permission: 'users:update', parameters: [idParam()] }) },

    '/api/v1/students/me': {
      get  : op('Students', 'Get own student profile', ['student'], { permission: 'students:read_own' }),
      patch: op('Students', 'Self-update personal contact fields', ['student']),
    },
    '/api/v1/students/me/academic-history': { get: op('Students', 'Get own complete enrollments & published results', ['student'], { permission: 'students:read_own' }) },
    '/api/v1/students': {
      get : op('Students', 'List students (faculty scoped to assigned courses/sections)', ['admin', 'faculty'], { permission: 'students:read', parameters: paginationParams }),
      post: op('Students', 'Transactional admission (User + Student + Section strength)', ['admin'], { status: 201, permission: 'students:create' }),
    },
    '/api/v1/students/{id}': {
      get   : op('Students', 'Get student profile (scoped IDOR protected)', ['admin', 'faculty', 'student'], { parameters: [idParam()] }),
      patch : op('Students', 'Admin update student academic/status/section', ['admin'], { permission: 'students:update', parameters: [idParam()] }),
      delete: op('Students', 'Soft-delete student', ['admin'], { permission: 'students:delete', parameters: [idParam()] }),
    },
    '/api/v1/students/{id}/academic-history': { get: op('Students', 'Get student academic history (self, assigned faculty, or admin)', ['admin', 'faculty', 'student'], { parameters: [idParam()] }) },

    '/api/v1/faculty/me': { get: op('Faculty', 'Get own faculty profile', ['faculty']), patch: op('Faculty', 'Update own faculty contact info', ['faculty']) },
    '/api/v1/faculty/me/courses': { get: op('Faculty', 'List assigned active courses', ['faculty']) },
    '/api/v1/faculty/me/students': { get: op('Faculty', 'List students in assigned classes', ['faculty']) },
    '/api/v1/faculty/me/timetable': { get: op('Faculty', 'Get personal weekly timetable', ['faculty']) },
    '/api/v1/faculty': {
      get : op('Faculty', 'List faculty members', ['admin'], { permission: 'faculty:read', parameters: paginationParams }),
      post: op('Faculty', 'Transactional User + Faculty creation', ['admin'], { status: 201, permission: 'faculty:create' }),
    },
    '/api/v1/faculty/{id}': {
      get   : op('Faculty', 'Get faculty profile', ['admin', 'faculty'], { permission: 'faculty:read', parameters: [idParam()] }),
      patch : op('Faculty', 'Update faculty profile', ['admin'], { permission: 'faculty:update', parameters: [idParam()] }),
      delete: op('Faculty', 'Soft-delete faculty profile', ['admin'], { permission: 'faculty:delete', parameters: [idParam()] }),
    },

    '/api/v1/departments': { get: op('Academic Setup', 'List departments', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create department', ['admin'], { status: 201, permission: 'departments:manage' }) },
    '/api/v1/departments/{id}': { get: op('Academic Setup', 'Get department details', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Academic Setup', 'Update department', ['admin'], { permission: 'departments:manage', parameters: [idParam()] }), delete: op('Academic Setup', 'Soft-delete unused department', ['admin'], { permission: 'departments:manage', parameters: [idParam()] }) },
    '/api/v1/departments/{id}/hod': { patch: op('Academic Setup', 'Transactionally assign department HOD', ['admin'], { permission: 'departments:manage', parameters: [idParam()] }) },

    '/api/v1/programs': { get: op('Academic Setup', 'List programs', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create program', ['admin'], { status: 201, permission: 'programs:manage' }) },
    '/api/v1/programs/{id}': { get: op('Academic Setup', 'Get program', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Academic Setup', 'Update program', ['admin'], { permission: 'programs:manage', parameters: [idParam()] }), delete: op('Academic Setup', 'Soft-delete unused program', ['admin'], { permission: 'programs:manage', parameters: [idParam()] }) },

    '/api/v1/academic-years/current': { get: op('Academic Setup', 'Get active academic year') },
    '/api/v1/academic-years/calendar/events': { get: op('Academic Setup', 'List academic calendar events', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create calendar event', ['admin'], { status: 201, permission: 'academic_calendar:manage' }) },
    '/api/v1/academic-years/calendar/events/{eventId}': { patch: op('Academic Setup', 'Update calendar event', ['admin'], { parameters: [idParam('eventId')] }), delete: op('Academic Setup', 'Soft-delete calendar event', ['admin'], { parameters: [idParam('eventId')] }) },
    '/api/v1/academic-years': { get: op('Academic Setup', 'List academic years', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create academic year', ['admin'], { status: 201, permission: 'academic_years:manage' }) },
    '/api/v1/academic-years/{id}': { get: op('Academic Setup', 'Get academic year', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Academic Setup', 'Update academic year', ['admin'], { permission: 'academic_years:manage', parameters: [idParam()] }), delete: op('Academic Setup', 'Delete unused academic year', ['admin'], { permission: 'academic_years:manage', parameters: [idParam()] }) },

    '/api/v1/semesters/current': { get: op('Academic Setup', 'Get current semester') },
    '/api/v1/semesters': { get: op('Academic Setup', 'List semesters', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create semester', ['admin'], { status: 201, permission: 'semesters:manage' }) },
    '/api/v1/semesters/{id}': { get: op('Academic Setup', 'Get semester', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Academic Setup', 'Update semester', ['admin'], { permission: 'semesters:manage', parameters: [idParam()] }) },

    '/api/v1/sections': { get: op('Academic Setup', 'List sections', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Academic Setup', 'Create section', ['admin'], { status: 201, permission: 'sections:manage' }) },
    '/api/v1/sections/{id}': { get: op('Academic Setup', 'Get section', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Academic Setup', 'Update section', ['admin'], { permission: 'sections:manage', parameters: [idParam()] }) },
    '/api/v1/sections/{id}/class-teacher': { patch: op('Academic Setup', 'Assign faculty class teacher', ['admin'], { permission: 'sections:manage', parameters: [idParam()] }) },

    '/api/v1/courses/assignments': { get: op('Courses & Materials', 'List faculty-course assignments', ['admin', 'faculty'], { parameters: paginationParams }), post: op('Courses & Materials', 'Assign faculty to course section', ['admin'], { status: 201, permission: 'course_assignments:manage' }) },
    '/api/v1/courses/assignments/{assignmentId}': { delete: op('Courses & Materials', 'Deactivate course assignment', ['admin'], { permission: 'course_assignments:manage', parameters: [idParam('assignmentId')] }) },
    '/api/v1/courses/{courseId}/materials': {
      get : op('Courses & Materials', 'List materials (assigned/enrolled scoped)', ['admin', 'faculty', 'student'], { permission: 'course_materials:read', parameters: [idParam('courseId'), ...paginationParams] }),
      post: op('Courses & Materials', 'Upload binary course material via configured StorageProvider', ['admin', 'faculty'], {
        status     : 201,
        permission : 'course_materials:manage',
        parameters : [idParam('courseId')],
        requestBody: multipartFileBody({ title: { type: 'string' }, semester: { type: 'string' }, academicYear: { type: 'string' }, section: { type: 'string' }, materialType: { type: 'string' }, isPublished: { type: 'boolean' } }, ['title', 'semester', 'academicYear']),
      }),
    },
    '/api/v1/courses/materials/{materialId}/download': { get: op('Courses & Materials', 'Authorized binary download or presigned S3 URL (audited)', ['admin', 'faculty', 'student'], { permission: 'course_materials:read', parameters: [idParam('materialId')] }) },
    '/api/v1/courses/materials/{materialId}': {
      patch : op('Courses & Materials', 'Update material metadata', ['admin', 'faculty'], { permission: 'course_materials:manage', parameters: [idParam('materialId')] }),
      delete: op('Courses & Materials', 'Soft-delete material & remove stored binary', ['admin', 'faculty'], { permission: 'course_materials:manage', parameters: [idParam('materialId')] }),
    },
    '/api/v1/courses': { get: op('Courses & Materials', 'List courses', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Courses & Materials', 'Create course', ['admin'], { status: 201, permission: 'courses:manage' }) },
    '/api/v1/courses/{id}': { get: op('Courses & Materials', 'Get course', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Courses & Materials', 'Update course', ['admin'], { permission: 'courses:manage', parameters: [idParam()] }), delete: op('Courses & Materials', 'Soft-delete course', ['admin'], { permission: 'courses:manage', parameters: [idParam()] }) },

    '/api/v1/enrollments/me': { get: op('Enrollments', 'List my enrollments', ['student'], { parameters: paginationParams }) },
    '/api/v1/enrollments': { get: op('Enrollments', 'List enrollments', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Enrollments', 'Enroll student (validates prerequisites, program, duplicates & credit cap)', ['admin', 'student'], { status: 201 }) },
    '/api/v1/enrollments/bulk': { post: op('Enrollments', 'Transactional bulk enrollment', ['admin'], { status: 201, permission: 'enrollments:manage' }) },
    '/api/v1/enrollments/{id}/drop': { patch: op('Enrollments', 'Drop enrollment', ['admin', 'student'], { parameters: [idParam()] }) },
    '/api/v1/enrollments/{id}/status': { patch: op('Enrollments', 'Admin update enrollment status/eligibility', ['admin'], { permission: 'enrollments:manage', parameters: [idParam()] }) },

    '/api/v1/timetables/me': { get: op('Timetables', 'Get student/faculty active timetable') },
    '/api/v1/timetables': { get: op('Timetables', 'List timetables', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Timetables', 'Create timetable with faculty conflict detection', ['admin'], { status: 201, permission: 'timetables:manage' }) },
    '/api/v1/timetables/{id}': { get: op('Timetables', 'Get timetable', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Timetables', 'Update timetable', ['admin'], { permission: 'timetables:manage', parameters: [idParam()] }) },
    '/api/v1/timetables/{id}/publish': { patch: op('Timetables', 'Publish timetable', ['admin'], { permission: 'timetables:manage', parameters: [idParam()] }) },

    '/api/v1/attendance/policy': { get: op('Attendance', 'Get active configurable attendance policy'), put: op('Attendance', 'Update attendance policy SystemSettings', ['admin'], { permission: 'settings:manage' }) },
    '/api/v1/attendance/me': { get: op('Attendance', 'Get my per-course attendance & requirement status', ['student']) },
    '/api/v1/attendance/students/{studentId}/summary': { get: op('Attendance', 'Get student attendance summary', ['admin', 'faculty', 'student'], { parameters: [idParam('studentId')] }) },
    '/api/v1/attendance/reports': { get: op('Attendance', 'Get class attendance shortage report', ['admin', 'faculty']) },
    '/api/v1/attendance/corrections': { get: op('Attendance', 'List attendance correction requests'), post: op('Attendance', 'Submit attendance correction request', ['student', 'faculty', 'admin'], { status: 201 }) },
    '/api/v1/attendance/corrections/{id}/review': { patch: op('Attendance', 'Transactionally approve/reject attendance correction', ['admin', 'faculty'], { permission: 'attendance:correction_approve', parameters: [idParam()] }) },
    '/api/v1/attendance/sessions': { get: op('Attendance', 'List attendance sessions', ['admin', 'faculty']), post: op('Attendance', 'Create attendance session (checks assignment & enrollments)', ['admin', 'faculty'], { status: 201, permission: 'attendance:mark' }) },
    '/api/v1/attendance/sessions/{id}': { get: op('Attendance', 'Get session details', ['admin', 'faculty'], { parameters: [idParam()] }), patch: op('Attendance', 'Update unfinalized session within editWindowHours', ['admin', 'faculty'], { parameters: [idParam()] }) },
    '/api/v1/attendance/sessions/{id}/finalize': { patch: op('Attendance', 'Finalize & lock attendance session', ['admin', 'faculty'], { parameters: [idParam()] }) },

    '/api/v1/examinations': { get: op('Examinations & Assessments', 'List examinations', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Examinations & Assessments', 'Create examination', ['admin'], { status: 201, permission: 'examinations:manage' }) },
    '/api/v1/examinations/{id}': { get: op('Examinations & Assessments', 'Get examination', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Examinations & Assessments', 'Update examination', ['admin'], { permission: 'examinations:manage', parameters: [idParam()] }) },
    '/api/v1/examinations/{id}/schedule': { patch: op('Examinations & Assessments', 'Update exam schedule slots', ['admin'], { permission: 'examinations:manage', parameters: [idParam()] }) },
    '/api/v1/examinations/{id}/status': { patch: op('Examinations & Assessments', 'Update examination status', ['admin'], { permission: 'examinations:manage', parameters: [idParam()] }) },
    '/api/v1/assessments': { get: op('Examinations & Assessments', 'List internal assessments', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Examinations & Assessments', 'Create assessment', ['admin', 'faculty'], { status: 201, permission: 'assessments:manage' }) },
    '/api/v1/assessments/{id}': { get: op('Examinations & Assessments', 'Get assessment', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), patch: op('Examinations & Assessments', 'Update assessment', ['admin', 'faculty'], { permission: 'assessments:manage', parameters: [idParam()] }), delete: op('Examinations & Assessments', 'Cancel assessment', ['admin', 'faculty'], { permission: 'assessments:manage', parameters: [idParam()] }) },

    '/api/v1/marks/me': { get: op('Marks & Results', 'Get own marks', ['student'], { parameters: paginationParams }) },
    '/api/v1/marks/corrections': { get: op('Marks & Results', 'List marks correction requests'), post: op('Marks & Results', 'Request marks correction / re-evaluation', ['student', 'faculty', 'admin'], { status: 201 }) },
    '/api/v1/marks/corrections/{id}/review': { patch: op('Marks & Results', 'Transactionally approve/reject marks correction', ['admin', 'faculty'], { parameters: [idParam()] }) },
    '/api/v1/marks/submit': { post: op('Marks & Results', 'Submit draft marks for admin approval', ['admin', 'faculty'], { permission: 'marks:submit' }) },
    '/api/v1/marks/approve-bulk': { post: op('Marks & Results', 'Bulk approve/reject marks', ['admin'], { permission: 'marks:verify' }) },
    '/api/v1/marks/{id}/approve': { patch: op('Marks & Results', 'Approve/reject single mark entry', ['admin'], { permission: 'marks:verify', parameters: [idParam()] }) },
    '/api/v1/marks': { get: op('Marks & Results', 'List marks', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Marks & Results', 'Enter single student mark', ['admin', 'faculty'], { status: 201, permission: 'marks:enter' }) },
    '/api/v1/marks/bulk': { post: op('Marks & Results', 'Bulk enter marks atomically', ['admin', 'faculty'], { status: 201, permission: 'marks:enter' }) },
    '/api/v1/marks/{id}': { patch: op('Marks & Results', 'Update unapproved mark', ['admin', 'faculty'], { permission: 'marks:enter', parameters: [idParam()] }) },

    '/api/v1/results/me': { get: op('Marks & Results', 'Get own published semester results', ['student']) },
    '/api/v1/results/me/backlogs': { get: op('Marks & Results', 'Get own backlog courses', ['student']) },
    '/api/v1/results/backlogs': { get: op('Marks & Results', 'List backlogs', ['admin', 'faculty']) },
    '/api/v1/results/reports/class-performance': { get: op('Marks & Results', 'Class result & SGPA performance report', ['admin', 'faculty']) },
    '/api/v1/results/student/{studentId}': { get: op('Marks & Results', 'Get results by student ID', ['admin', 'faculty', 'student'], { parameters: [idParam('studentId')] }) },
    '/api/v1/results': { get: op('Marks & Results', 'List results', ['admin', 'faculty', 'student'], { parameters: paginationParams }) },
    '/api/v1/results/generate': { post: op('Marks & Results', 'Transactionally compute SGPA/CGPA from verified marks', ['admin'], { status: 201, permission: 'results:publish' }) },
    '/api/v1/results/{id}/publish': { patch: op('Marks & Results', 'Publish result, update Student.cgpa & notify student', ['admin'], { permission: 'results:publish', parameters: [idParam()] }) },

    '/api/v1/fees/me': { get: op('Fees & Payments', 'Get student fee records & balance summary', ['student'], { permission: 'fees:read_own' }) },
    '/api/v1/fees/structures': { get: op('Fees & Payments', 'List fee structures', ['admin', 'student'], { parameters: paginationParams }), post: op('Fees & Payments', 'Create fee structure', ['admin'], { status: 201, permission: 'fees:manage' }) },
    '/api/v1/fees/structures/{id}': { get: op('Fees & Payments', 'Get fee structure', ['admin', 'student'], { parameters: [idParam()] }), patch: op('Fees & Payments', 'Update fee structure', ['admin'], { permission: 'fees:manage', parameters: [idParam()] }) },
    '/api/v1/fees/records': { get: op('Fees & Payments', 'List fee records', ['admin', 'student'], { parameters: paginationParams }) },
    '/api/v1/fees/records/{id}': { get: op('Fees & Payments', 'Get fee record', ['admin', 'student'], { parameters: [idParam()] }) },
    '/api/v1/fees/records/assign': { post: op('Fees & Payments', 'Batch assign fees transactionally + notify students', ['admin'], { status: 201, permission: 'fees:manage' }) },
    '/api/v1/fees/records/{id}/concession': { patch: op('Fees & Payments', 'Update concession/fine/status on fee record', ['admin'], { permission: 'fees:manage', parameters: [idParam()] }) },
    '/api/v1/fees/records/apply-late-fines': { post: op('Fees & Payments', 'Evaluate and apply overdue late fines transactionally', ['admin'], { permission: 'fees:manage' }) },

    '/api/v1/payments/me': { get: op('Fees & Payments', 'Get own payment history', ['student'], { permission: 'payments:read_own', parameters: paginationParams }) },
    '/api/v1/payments/reconciliation/summary': { get: op('Fees & Payments', 'Get reconciliation summary', ['admin'], { permission: 'payments:reconcile' }) },
    '/api/v1/payments': { get: op('Fees & Payments', 'List payments', ['admin', 'student'], { parameters: paginationParams }), post: op('Fees & Payments', 'Record manual/reference payment (students always pending)', ['admin', 'student'], { status: 201 }) },
    '/api/v1/payments/initiate': { post: op('Fees & Payments', 'Initiate online gateway order/intent (requires configured provider credentials)', ['admin', 'student'], { status: 201 }) },
    '/api/v1/payments/{id}': { get: op('Fees & Payments', 'Get payment details', ['admin', 'student'], { parameters: [idParam()] }) },
    '/api/v1/payments/{id}/receipt': { get: op('Fees & Payments', 'Get official payment receipt', ['admin', 'student'], { parameters: [idParam()] }) },
    '/api/v1/payments/{id}/verify': { post: op('Fees & Payments', 'Verify provider checkout HMAC signature and credit fee record', ['admin', 'student'], { parameters: [idParam()] }) },
    '/api/v1/payments/{id}/reconcile': { patch: op('Fees & Payments', 'Reconcile payment record and settle/reverse fee balance', ['admin'], { permission: 'payments:reconcile', parameters: [idParam()] }) },
    '/api/v1/payments/webhooks/{provider}': {
      post: op('Fees & Payments', 'Verified HMAC webhook receiver (Razorpay/Stripe) with idempotency protection', ['provider-webhook'], {
        public    : true,
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['razorpay', 'stripe'] } }],
      }),
    },

    '/api/v1/announcements': { get: op('Communications & Grievances', 'List scoped announcements', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Communications & Grievances', 'Create announcement', ['admin', 'faculty'], { status: 201 }) },
    '/api/v1/announcements/{id}': { patch: op('Communications & Grievances', 'Update announcement', ['admin', 'faculty'], { parameters: [idParam()] }), delete: op('Communications & Grievances', 'Soft-delete announcement', ['admin', 'faculty'], { parameters: [idParam()] }) },
    '/api/v1/notifications/me': { get: op('Communications & Grievances', 'List my notifications', ['admin', 'faculty', 'student'], { parameters: paginationParams }) },
    '/api/v1/notifications/me/unread-count': { get: op('Communications & Grievances', 'Get unread notification count') },
    '/api/v1/notifications/me/read-all': { patch: op('Communications & Grievances', 'Mark all my notifications read') },
    '/api/v1/notifications/me/{id}/read': { patch: op('Communications & Grievances', 'Mark one notification read', ['admin', 'faculty', 'student'], { parameters: [idParam()] }) },
    '/api/v1/notifications': { post: op('Communications & Grievances', 'Bulk dispatch notifications', ['admin'], { status: 201, permission: 'notifications:manage' }) },

    '/api/v1/documents': {
      get : op('Documents', 'List scoped documents', ['admin', 'faculty', 'student'], { parameters: paginationParams }),
      post: op('Documents', 'Upload document binary file via StorageProvider', ['admin', 'faculty', 'student'], {
        status     : 201,
        permission : 'documents:upload',
        requestBody: multipartFileBody({ title: { type: 'string' }, type: { type: 'string' }, student: { type: 'string' }, isPublic: { type: 'boolean' } }, ['title', 'type']),
      }),
    },
    '/api/v1/documents/{id}': { get: op('Documents', 'Get document metadata', ['admin', 'faculty', 'student'], { parameters: [idParam()] }), delete: op('Documents', 'Delete own/admin document & stored file', ['admin', 'faculty', 'student'], { parameters: [idParam()] }) },
    '/api/v1/documents/{id}/download': { get: op('Documents', 'Authorized binary download or presigned S3 URL (audited)', ['admin', 'faculty', 'student'], { parameters: [idParam()] }) },
    '/api/v1/documents/{id}/verify': { patch: op('Documents', 'Verify or reject document & notify owner', ['admin', 'faculty'], { permission: 'documents:verify', parameters: [idParam()] }) },

    '/api/v1/grievances': { get: op('Communications & Grievances', 'List grievances (internal comments stripped from students)', ['admin', 'faculty', 'student'], { parameters: paginationParams }), post: op('Communications & Grievances', 'Submit grievance ticket', ['admin', 'faculty', 'student'], { status: 201 }) },
    '/api/v1/grievances/{id}': { get: op('Communications & Grievances', 'Get grievance details', ['admin', 'faculty', 'student'], { parameters: [idParam()] }) },
    '/api/v1/grievances/{id}/comments': { post: op('Communications & Grievances', 'Add grievance comment (audited)', ['admin', 'faculty', 'student'], { status: 201, parameters: [idParam()] }) },
    '/api/v1/grievances/{id}/assign': { patch: op('Communications & Grievances', 'Assign grievance ticket', ['admin'], { permission: 'grievances:manage', parameters: [idParam()] }) },
    '/api/v1/grievances/{id}/status': { patch: op('Communications & Grievances', 'Update grievance status & notify owner', ['admin', 'faculty'], { parameters: [idParam()] }) },

    '/api/v1/reports/institution-overview': { get: op('Reports & Governance', 'Institution summary report', ['admin'], { permission: 'reports:read' }) },
    '/api/v1/reports/attendance': { get: op('Reports & Governance', 'Attendance shortage report', ['admin', 'faculty'], { permission: 'reports:read' }) },
    '/api/v1/reports/academic-performance': { get: op('Reports & Governance', 'Course performance report', ['admin', 'faculty'], { permission: 'reports:read' }) },
    '/api/v1/reports/fees': { get: op('Reports & Governance', 'Fee collection & concession report', ['admin'], { permission: 'reports:read' }) },
    '/api/v1/reports/grievances': { get: op('Reports & Governance', 'Grievance SLA & category report', ['admin'], { permission: 'reports:read' }) },

    '/api/v1/audit-logs': { get: op('Reports & Governance', 'List immutable audit logs', ['admin'], { permission: 'audit_logs:read', parameters: paginationParams }) },
    '/api/v1/audit-logs/{id}': { get: op('Reports & Governance', 'Get audit log record', ['admin'], { permission: 'audit_logs:read', parameters: [idParam()] }) },

    '/api/v1/settings/public': { get: op('Reports & Governance', 'Get public institutional configuration merged with safe defaults') },
    '/api/v1/settings': { get: op('Reports & Governance', 'List all SystemSettings', ['admin'], { permission: 'settings:manage' }), post: op('Reports & Governance', 'Create or upsert SystemSetting', ['admin'], { status: 201, permission: 'settings:manage' }) },
    '/api/v1/settings/{key}': {
      get: op('Reports & Governance', 'Get setting by key', ['admin'], { permission: 'settings:manage', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }] }),
      put: op('Reports & Governance', 'Update setting by key', ['admin'], { permission: 'settings:manage', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }] }),
    },
  },
};

module.exports = { openApiSpec };

