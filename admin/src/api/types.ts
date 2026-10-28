export type Role = 'superadmin' | 'school_admin' | 'teacher'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK'

export interface ApiMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: ApiMeta
}

export interface ApiFieldError {
  path: string
  message: string
}

export interface ApiErrorBody {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: ApiFieldError[]
  }
}

export interface Paginated<T> {
  items: T[]
  meta: ApiMeta
}

export interface PageParams {
  page?: number
  limit?: number
  search?: string
}

export interface User {
  id: string
  fullName: string
  username: string
  role: Role
  schoolId: string | null
  permissions: string[]
  phone?: string | null
  /** Imzolangan rasm havolasi (yoki null) */
  photo?: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type SchoolAdmin = User
export interface Teacher extends User {
  phone?: string | null
  classes?: { id: string; name: string }[]
  /** Faol yildagi sinf+fan biriktirishlari */
  subjectAssignments?: TeacherSubjectAssignment[]
  /** Sinf rahbari bo'lgan sinflar (xulq bahosini shu sinflarda qo'yadi) */
  homeroomClasses?: { id: string; name: string }[]
}

export interface TeacherSubjectAssignment {
  classId: string
  className: string
  subjectId: string
  subjectName: string
}

export interface School {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  logoUrl: string | null
  isActive: boolean
  createdAt: string
}

export interface PermissionMeta {
  key: string
  group: string
  label: string
  roles: string[]
}

export interface LoginPayload {
  username: string
  password: string
}

export interface AuthResult {
  accessToken: string
  user: User
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface SchoolListParams extends PageParams {
  isActive?: boolean
}

export interface SchoolPayload {
  name: string
  slug: string
  address?: string
  phone?: string
  logoUrl?: string
}

export interface SchoolUpdatePayload {
  name?: string
  slug?: string
  /** null - maydonni tozalash */
  address?: string | null
  phone?: string | null
  logoUrl?: string | null
  isActive?: boolean
}

export interface SchoolAdminListParams extends PageParams {
  schoolId?: string
}

export interface SchoolAdminCreatePayload {
  schoolId: string
  fullName: string
  username: string
  password: string
  permissions: string[]
}

export interface SchoolAdminUpdatePayload {
  fullName?: string
  isActive?: boolean
}

export interface TeacherListParams extends PageParams {
  isActive?: boolean
}

export interface TeacherCreatePayload {
  fullName: string
  username: string
  password: string
  phone?: string
  permissions: string[]
}

export interface TeacherUpdatePayload {
  fullName?: string
  /** null - telefonni tozalash */
  phone?: string | null
  isActive?: boolean
}

// ---- O'quv yillari ----
export interface AcademicPeriod {
  id?: string
  name: string
  startDate: string
  endDate: string
}

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  periods: AcademicPeriod[]
  createdAt: string
}

export interface AcademicYearPayload {
  name: string
  startDate: string
  endDate: string
  periods: AcademicPeriod[]
}

// ---- Sinflar ----
export interface PersonRef {
  id: string
  fullName: string
}

export interface SchoolClass {
  id: string
  name: string
  grade: number
  section: string | null
  academicYearId: string
  homeroomTeacherId: string | null
  homeroomTeacher: PersonRef | null
  teacherIds: string[]
  teachers: PersonRef[]
  /** Fan -> o'qituvchi biriktirishlari */
  subjects?: ClassSubjectAssignment[]
  studentsCount: number
  isArchived: boolean
  createdAt: string
}

export interface ClassSubjectAssignment {
  subjectId: string
  subject: { id: string; name: string } | null
  teacherId: string
  teacher: PersonRef | null
}

export interface ClassSubjectInput {
  subjectId: string
  teacherId: string
}

export interface ClassListParams extends PageParams {
  academicYearId?: string
  grade?: number
  isArchived?: boolean
}

export interface ClassPayload {
  name: string
  grade: number
  section?: string | null
  academicYearId?: string
  homeroomTeacherId?: string | null
  teacherIds?: string[]
  subjects?: ClassSubjectInput[]
}

export interface ClassTeachersPayload {
  teacherIds: string[]
  homeroomTeacherId: string | null
}

// ---- O'quvchilar ----
export type Gender = 'male' | 'female'
export type StudentStatus = 'active' | 'transferred' | 'graduated'

export interface Student {
  id: string
  fullName: string
  studentCode: string | null
  birthDate: string | null
  gender: Gender | null
  classId: string
  class: { id: string; name: string }
  parentPhone: string | null
  photoUrl: string | null
  /** Yuklangan rasm: imzolangan havola yoki null */
  photo?: string | null
  status: StudentStatus
  createdAt: string
}

export interface StudentListParams extends PageParams {
  classId?: string
  status?: StudentStatus
}

export interface StudentPayload {
  fullName: string
  classId: string
  studentCode?: string | null
  birthDate?: string | null
  gender?: Gender | null
  parentPhone?: string | null
  status?: StudentStatus
}

// ---- Excel import ----
export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate'
export type DuplicateMode = 'skip' | 'update'

export interface ImportRow {
  row: number
  status: ImportRowStatus
  data: {
    fullName: string | null
    className: string | null
    birthDate: string | null
    gender: string | null
    studentCode: string | null
    parentPhone: string | null
  }
  resolvedClassId: string | null
  duplicateOfStudentId: string | null
  errors: string[]
}

export interface ImportPreview {
  importId: string
  expiresAt: string
  summary: { total: number; valid: number; invalid: number; duplicates: number }
  rows: ImportRow[]
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  failed: number
}

// ---- O'qituvchilarni Excel'dan import ----
export type TeacherImportStatus = 'create' | 'skip_existing' | 'error'

export interface TeacherImportRow {
  rowNo: number
  fullName: string
  phone: string | null
  login: string | null
  loginGenerated: boolean
  passwordGenerated: boolean
  status: TeacherImportStatus
  messages: string[]
  /** Faqat status=create bo'lganda (hech qayerda saqlanmaydi) */
  password: string | null
}

export interface TeacherImportPreview {
  summary: { total: number; create: number; skipExisting: number; error: number }
  rows: TeacherImportRow[]
}

export type TeacherImportResultStatus = 'created' | 'skipped' | 'failed'

export interface TeacherImportResultRow {
  rowNo: number
  fullName: string
  phone: string | null
  login: string | null
  password: string | null
  status: TeacherImportResultStatus
  message: string | null
}

export interface TeacherImportResult {
  summary: { total: number; created: number; skipped: number; failed: number }
  results: TeacherImportResultRow[]
}

// ---- Dashboard ----
export interface DashboardSummary {
  students: number
  classes: number
  teachers: number
  scoresToday: number
  unscoredClassesToday?: number
  attendanceToday?: AttendanceToday
  schools?: number
}

// ---- Xulq turlari ----
export type BehaviorKind = 'positive' | 'negative' | 'neutral'

export interface BehaviorType {
  id: string
  schoolId: string | null
  name: string
  kind: BehaviorKind
  color: string
  order: number
  minScore: number | null
  maxScore: number | null
  isActive: boolean
  createdAt: string
}

export interface BehaviorTypeListParams {
  isActive?: boolean
  scope?: 'global' | 'school' | 'all'
}

export interface BehaviorTypePayload {
  name: string
  kind: BehaviorKind
  color: string
  order: number
  minScore?: number | null
  maxScore?: number | null
}

export interface BehaviorTypeCreatePayload extends BehaviorTypePayload {
  /** null - global */
  schoolId: string | null
}

// ---- Fanlar va fan baholari ----
export interface Subject {
  id: string
  /** null - global */
  schoolId: string | null
  name: string
  order: number
  isActive: boolean
  createdAt: string
}

export interface SubjectListParams {
  isActive?: boolean
  scope?: 'global' | 'school' | 'all'
}

export interface SubjectPayload {
  name: string
  order?: number
}

export interface SubjectCreatePayload extends SubjectPayload {
  /** null - global (faqat superadmin) */
  schoolId?: string | null
}

export type GradeValue = 2 | 3 | 4 | 5

export interface SubjectGrade {
  id: string
  studentId: string
  student: PersonRef
  classId: string
  class: { id: string; name: string }
  subjectId: string
  subject: { id: string; name: string }
  teacherId: string
  teacher: PersonRef
  academicYearId: string
  value: number
  comment: string | null
  date: string
  editable: boolean
  createdAt: string
  updatedAt: string
}

export interface GradeAssignment {
  classId: string
  className: string
  grade: number
  subjectId: string
  subjectName: string
}

export interface GradeAssignments {
  /** assigned - o'qituvchi (faqat biriktirilganlar); all - admin (istalgan sinf/fan) */
  mode: 'assigned' | 'all'
  assignments: GradeAssignment[]
}

export interface GradeSheetStudent {
  studentId: string
  fullName: string
  studentCode: string | null
  photo?: string | null
  grade: SubjectGrade | null
  alreadyGraded: boolean
}

export interface GradeSheet {
  class: { id: string; name: string }
  subject: { id: string; name: string }
  date: string
  settings: { editWindowHours: number; backdateDays: number }
  students: GradeSheetStudent[]
}

export interface GradeUpdatePayload {
  value?: number
  comment?: string | null
}

export interface BulkGradeItem {
  studentId: string
  value: number
  comment?: string | null
}

export interface BulkGradesPayload {
  classId: string
  subjectId: string
  date: string
  items: BulkGradeItem[]
}

export interface GradeListParams extends PageParams {
  classId?: string
  subjectId?: string
  studentId?: string
  teacherId?: string
  from?: string
  to?: string
  sort?: string
}

export interface SubjectAverage {
  subjectId: string
  name: string
  average: number
  count: number
  lastValue: number
  lastDate: string
}

export interface StudentGradeSummary {
  studentId: string
  from: string
  to: string
  average: number | null
  /** 100 ballik shkala (o'rtacha x 20) */
  average100: number | null
  gradesCount: number
  bySubject: SubjectAverage[]
  recent: SubjectGrade[]
}

// ---- Baholash sozlamalari ----
export type DailyAggregation = 'average' | 'min' | 'last'

export interface ScoringSettings {
  minScore: number
  maxScore: number
  requireBehaviorType: boolean
  commentRequiredBelow: number | null
  editWindowHours: number
  backdateDays: number
  dailyAggregation: DailyAggregation
}

export interface ScoringSettingsResponse {
  effective: ScoringSettings
  global: ScoringSettings
  override: Partial<ScoringSettings> | null
}

export interface SaveScoringSettingsPayload {
  scope: 'global' | 'school'
  schoolId?: string
  values: Partial<ScoringSettings> | null
}

// ---- Baholar ----
export interface BehaviorRef {
  id: string
  name: string
  kind: BehaviorKind
  color: string
}

export interface Score {
  id: string
  studentId: string
  student: PersonRef
  classId: string
  class: { id: string; name: string }
  teacherId: string
  teacher: PersonRef
  academicYearId: string
  behaviorTypeId: string | null
  behaviorType: BehaviorRef | null
  value: number
  comment: string | null
  date: string
  editable: boolean
  createdAt: string
  updatedAt: string
}

export interface ScoringSheetStudent {
  studentId: string
  fullName: string
  studentCode: string | null
  photo?: string | null
  myScore: Score | null
  dayScore: number | null
  scoresCount: number
}

export interface ScoringSheet {
  class: { id: string; name: string }
  date: string
  settings: ScoringSettings
  students: ScoringSheetStudent[]
}

export interface ScorePayload {
  studentId: string
  date?: string
  value: number
  behaviorTypeId?: string | null
  comment?: string | null
}

export interface ScoreUpdatePayload {
  value?: number
  behaviorTypeId?: string | null
  comment?: string | null
}

export interface BulkScoreItem {
  studentId: string
  value: number
  behaviorTypeId?: string | null
  comment?: string | null
}

export interface BulkScoresPayload {
  classId: string
  date: string
  items: BulkScoreItem[]
}

export interface BulkScoresResult {
  created: number
  updated: number
  failed: { studentId: string; code: string; message: string }[]
}

export interface ScoreListParams extends PageParams {
  classId?: string
  studentId?: string
  teacherId?: string
  behaviorTypeId?: string
  from?: string
  to?: string
  sort?: string
}

export interface TodayProgress {
  classId: string
  className: string
  scored: number
  total: number
}

export interface TrendPoint {
  date: string
  dayScore: number
}

export interface BehaviorBreakdown {
  behaviorTypeId: string | null
  name: string
  kind: BehaviorKind
  color: string
  count: number
}

export interface StudentScoreSummary {
  studentId: string
  from: string
  to: string
  average: number | null
  daysCount: number
  scoresCount: number
  trend: TrendPoint[]
  byBehaviorType: BehaviorBreakdown[]
  recent: Score[]
}

// ---- Reyting va ochiq ko'rinish sozlamalari ----
export interface SettingsResponse<T> {
  effective: T
  global: T
  override: Partial<T> | null
}

export interface SaveSettingsPayload<T> {
  scope: 'global' | 'school'
  schoolId?: string
  values: Partial<T> | null
}

export type RatingPeriodType = 'week' | 'month' | 'quarter' | 'academic_year' | 'custom'
export type RatingMethod = 'average' | 'sum'
export type TieBreakKey = 'daysCount' | 'scoresCount' | 'alphabetical'
export type RefreshMode = 'realtime' | 'nightly'

export interface RatingSettings {
  periodType: RatingPeriodType
  customFrom: string | null
  customTo: string | null
  method: RatingMethod
  minScoresCount: number
  tieBreak: TieBreakKey[]
  refreshMode: RefreshMode
  /** Reyting tarkibi: xulq va fan baholari ulushlari (yig'indisi 100) */
  weights: RatingWeights
}

export interface RatingWeights {
  conduct: number
  subjects: number
}

export interface PublicSettings {
  enabled: boolean
  showScope: 'own' | 'global'
  includeInGlobal: boolean
  showClasses: boolean
  showStudents: boolean
  topStudents: number | null
  showScores: boolean
  showMedals: boolean
  showTrend: boolean
  showPhotos: boolean
  title: string | null
  subtitle: string | null
  primaryColor: string | null
  autoRefreshSeconds: number
  tvSlideSeconds: number
  globalRatingEnabled: boolean
}

// ---- Reyting ----
export interface RatingPeriod {
  type: RatingPeriodType
  from: string
  to: string
  key: string
  label: string
  fallback?: boolean
}

export interface RatingConfig {
  period: RatingPeriod
  settings: RatingSettings
  calculatedAt: string | null
}

export interface StudentRatingItem {
  rank: number | null
  previousRank: number | null
  rankChange: number | null
  studentId: string
  fullName: string
  classId: string
  className: string
  score: number
  daysCount: number
  scoresCount: number
  eligible: boolean
  /** Davomat jarimasi (reytingga ta'sir yoqilgan bo'lsa) */
  penalty?: number
}

export interface ClassRatingItem {
  rank: number
  previousRank: number | null
  rankChange: number | null
  classId: string
  className: string
  grade: number
  score: number
  ratedStudents: number
  totalStudents: number
}

export interface SchoolRatingItem {
  rank: number
  schoolId: string
  name: string
  slug: string
  score: number
  ratedStudents: number
  totalStudents: number
  enabled: boolean
}

export interface RatingListResult<T> {
  period: RatingPeriod
  calculatedAt: string | null
  items: T[]
  meta: ApiMeta
}

export interface StudentRatingParams {
  classId?: string
  grade?: number
  search?: string
  includeIneligible?: boolean
  page?: number
  limit?: number
  from?: string
  to?: string
}

// ---- Davomat ----
export type AttendanceCategory = 'present' | 'late' | 'absent_excused' | 'absent_unexcused'

export interface AttendanceStatus {
  id: string
  schoolId: string | null
  name: string
  shortName: string
  color: string
  category: AttendanceCategory
  isDefault: boolean
  order: number
  isActive: boolean
  createdAt: string
}

export interface AttendanceStatusListParams {
  isActive?: boolean
  scope?: 'global' | 'school' | 'all'
}

export interface AttendanceStatusPayload {
  name: string
  shortName: string
  color: string
  category: AttendanceCategory
  order: number
  isDefault: boolean
}

export interface AttendanceStatusCreatePayload extends AttendanceStatusPayload {
  /** null - global */
  schoolId: string | null
}

export type AttendanceMode = 'daily' | 'lesson'

export interface RatingImpact {
  enabled: boolean
  penaltyLate: number
  penaltyAbsentExcused: number
  penaltyAbsentUnexcused: number
}

export interface AttendanceSettings {
  mode: AttendanceMode
  lessonsPerDay: number
  /** ISO hafta kunlari: 1 = dushanba ... 7 = yakshanba */
  workingWeekdays: number[]
  editWindowHours: number
  backdateDays: number
  noteRequiredCategories: AttendanceCategory[]
  ratingImpact: RatingImpact
}

export interface AttendanceRecord {
  id: string
  studentId: string
  student: PersonRef
  classId: string
  class: { id: string; name: string }
  date: string
  lessonNo: number
  statusId: string
  status: {
    id: string
    name: string
    shortName: string
    color: string
    category: AttendanceCategory
  }
  minutesLate: number | null
  note: string | null
  markedBy: PersonRef
  updatedBy: PersonRef
  editable: boolean
  createdAt: string
  updatedAt: string
}

export interface AttendanceSheetStudent {
  studentId: string
  fullName: string
  studentCode: string | null
  photo?: string | null
  record: AttendanceRecord | null
}

export interface AttendanceSheetSummary {
  total: number
  marked: number
  present: number
  late: number
  absentExcused: number
  absentUnexcused: number
}

export interface AttendanceSheet {
  class: { id: string; name: string }
  date: string
  mode: AttendanceMode
  lessonNo: number | null
  lessonsPerDay: number
  isWorkingDay: boolean
  settings: AttendanceSettings
  statuses: AttendanceStatus[]
  students: AttendanceSheetStudent[]
  summary: AttendanceSheetSummary
}

export interface AttendanceBulkItem {
  studentId: string
  statusId: string
  minutesLate?: number | null
  note?: string | null
}

export interface AttendanceBulkPayload {
  classId: string
  date: string
  lessonNo?: number
  items: AttendanceBulkItem[]
}

export interface AttendanceUpdatePayload {
  statusId?: string
  minutesLate?: number | null
  note?: string | null
}

export interface AttendanceListParams extends PageParams {
  classId?: string
  studentId?: string
  statusId?: string
  category?: AttendanceCategory
  from?: string
  to?: string
  lessonNo?: number
  sort?: string
}

export interface AttendanceSummaryStudent {
  studentId: string
  fullName: string
  present: number
  late: number
  absentExcused: number
  absentUnexcused: number
  total: number
  rate: number | null
}

export interface AttendanceSummary {
  from: string
  to: string
  unit: 'day' | 'lesson'
  class?: { total: number; rate: number | null }
  students: AttendanceSummaryStudent[]
}

export interface AttendanceDay {
  date: string
  category: AttendanceCategory
  lessons: number
  records: { lessonNo: number; statusId: string; category: AttendanceCategory }[]
}

export interface StudentAttendanceSummary {
  studentId: string
  from: string
  to: string
  total: number
  present: number
  late: number
  absentExcused: number
  absentUnexcused: number
  rate: number | null
  byStatus: {
    statusId: string
    name: string
    color: string
    category: AttendanceCategory
    count: number
  }[]
  days: AttendanceDay[]
  recent: AttendanceRecord[]
}

export interface AttendanceProgress {
  classId: string
  className: string
  markedUnits: number
  totalUnits: number
  markedStudents: number
  totalStudents: number
}

export interface AttendanceToday {
  present: number
  late: number
  absent: number
  total: number
  unmarkedClasses: number
}

// ---- Hisobotlar ----
export interface ReportMeta {
  generatedAt: string
  period: { from: string; to: string }
  school: { id: string; name: string } | null
  scope?: string
}

export interface ReportBehaviorShare {
  behaviorTypeId: string | null
  name: string
  kind: BehaviorKind
  color: string
  count: number
}

export interface ReportAttendanceCounts {
  present: number
  late: number
  absentExcused: number
  absentUnexcused: number
  total: number
  rate: number | null
}

export interface ClassReportStudent {
  studentId: string
  fullName: string
  studentCode: string | null
  rank: number | null
  /** Sinf ichidagi o'rin (reytingdagi o'quvchilar orasida) */
  classRank: number | null
  ratingScore: number | null
  avgScore: number | null
  minScore: number | null
  maxScore: number | null
  daysCount: number
  scoresCount: number
  attendance: ReportAttendanceCounts
  penalty: number
  topBehavior: { name: string; count: number } | null
}

export interface ClassReport {
  meta: ReportMeta
  class: {
    id: string
    name: string
    grade: number
    homeroomTeacher: { id: string; fullName: string } | null
  }
  summary: {
    students: number
    ratedStudents: number
    avgScore: number | null
    daysScored: number
    scoresCount: number
    attendanceRate: number | null
    penaltyTotal: number
  }
  students: ClassReportStudent[]
  behaviorDistribution: ReportBehaviorShare[]
}

export interface StudentReport {
  meta: ReportMeta
  student: {
    id: string
    fullName: string
    studentCode: string | null
    birthDate: string | null
    gender: Gender | null
    class: { id: string; name: string }
    status: StudentStatus
    parentPhone?: string | null
  }
  score: {
    avgScore: number | null
    minScore: number | null
    maxScore: number | null
    daysCount: number
    scoresCount: number
    rank: number | null
    classRank: number | null
    ratingScore: number | null
    ratedStudentsInClass: number
  }
  trend: TrendPoint[]
  behaviorDistribution: ReportBehaviorShare[]
  attendance: Omit<ReportAttendanceCounts, 'rate'> & {
    rate: number | null
    penalty: number
    days: { date: string; category: AttendanceCategory }[]
  }
  entries: {
    date: string
    value: number
    behaviorType: { id?: string; name: string; color?: string; kind?: BehaviorKind } | null
    comment: string | null
    teacher: PersonRef
  }[]
}

export interface TeacherReportItem {
  teacherId: string
  fullName: string
  username: string
  isActive: boolean
  classes: { id: string; name: string }[]
  scoresCount: number
  daysActive: number
  studentsScored: number
  attendanceUnits: number
  attendanceDays: number
  lastActivityAt: string | null
  coverage: { expectedClassDays: number; scoredClassDays: number; rate: number | null }
}

export interface TeachersReport {
  meta: ReportMeta
  teachers: TeacherReportItem[]
}

export interface SchoolReport {
  meta: ReportMeta
  totals: {
    students: number
    classes: number
    teachers: number
    scoresCount: number
    avgScore: number | null
    attendanceRate: number | null
    penaltyTotal: number
  }
  classes: {
    classId: string
    className: string
    grade: number
    studentsCount: number
    ratedStudents: number
    avgScore: number | null
    ratingScore: number | null
    rank: number | null
    attendanceRate: number | null
    scoresCount: number
  }[]
  behaviorDistribution: ReportBehaviorShare[]
  dailyTrend: {
    date: string
    avgScore: number | null
    attendanceRate: number | null
    scoresCount: number
  }[]
}

export interface BehaviorTopStudent {
  studentId: string
  fullName: string
  className: string
  count: number
}

export interface BehaviorReport {
  meta: ReportMeta
  byType: (ReportBehaviorShare & { studentsCount: number })[]
  byKind: { positive: number; negative: number; neutral: number }
  byClass: {
    classId: string
    className: string
    positive: number
    negative: number
    neutral: number
    total: number
  }[]
  topStudents: { positive: BehaviorTopStudent[]; negative: BehaviorTopStudent[] }
}

export interface SchoolsReportItem {
  schoolId: string
  name: string
  slug: string
  enabled: boolean
  students: number
  classes: number
  teachers: number
  scoresCount: number
  avgScore: number | null
  ratingScore: number | null
  attendanceRate: number | null
  activeTeachers: number
}

export interface SchoolsReport {
  meta: ReportMeta
  schools: SchoolsReportItem[]
}

export type ReportType = 'class' | 'student' | 'teachers' | 'school' | 'behavior' | 'schools'
export type ExportFormat = 'xlsx' | 'pdf'

export interface ReportParams {
  from: string
  to: string
  classId?: string
}

// ---- Audit log ----
export interface AuditLogItem {
  id: string
  createdAt: string
  user: { id: string; fullName: string; username: string; role: Role } | null
  schoolId: string | null
  school: { id: string; name: string } | null
  action: string
  entity: string | null
  entityId: string | null
  before: unknown
  after: unknown
  ip: string | null
}

export interface AuditLogParams extends PageParams {
  from?: string
  to?: string
  userId?: string
  action?: string
  entity?: string
  schoolId?: string
  sort?: string
}

export interface AuditFilters {
  actions: string[]
  entities: string[]
  users: { id: string; fullName: string; username: string; role: Role }[]
}
