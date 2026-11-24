export type Role = 'superadmin' | 'school_admin' | 'teacher'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_PASSWORD'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE'
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
  /** Asosiy superadmin (faqat superadmin uchun ma'noga ega) */
  isOwner?: boolean
  lastLoginAt: string | null
  createdAt: string
}

/** O'z profilini tahrirlash (PATCH /auth/me). Login o'zgarsa currentPassword majburiy. */
export interface UpdateProfilePayload {
  fullName?: string
  username?: string
  /** '' yoki null - telefonni o'chirish */
  phone?: string | null
  currentPassword?: string
}

/** Superadminlar ro'yxati elementi (GET /superadmins) */
export interface Superadmin {
  id: string
  fullName: string
  username: string
  isActive: boolean
  isOwner: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface SuperadminCreatePayload {
  fullName: string
  username: string
  password: string
  currentPassword: string
}

export interface SuperadminUpdatePayload {
  isActive?: boolean
  password?: string
  fullName?: string
  currentPassword: string
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
  /** Yuklangan logo (versiyalangan havola) yoki eski qo'lda kiritilgan URL */
  logoUrl: string | null
  hasUploadedLogo?: boolean
  isActive: boolean
  /** Butunlay o'chirish boshlangan vaqt (yarim yo'lda to'xtagan bo'lsa); aks holda null */
  deletingAt?: string | null
  createdAt: string
}

/** Maktabni butunlay o'chirishdan oldingi ko'rinish: nimalar o'chishi (sonlar) */
export interface SchoolDeletePreview {
  school: { id: string; name: string; slug: string; isActive: boolean; deletingAt: string | null }
  items: { key: string; label: string; count: number }[]
  total: number
  users: { teachers: number; schoolAdmins: number }
  superadminsSkipped: number
}

export interface SchoolDeletePayload {
  confirmName: string
  password: string
  acknowledge: true
}

export interface SchoolDeleteResult {
  deleted: true
  school: { id: string; name: string }
  counts: Record<string, number>
  total: number
  resumed: boolean
}

export interface BrandingIcons {
  favicon: string
  icon192: string
  icon512: string
  maskable512: string
  apple180: string
}

export interface Branding {
  appName: string
  shortName: string
  logoUrl: string | null
  icons: BrandingIcons | null
  version: string
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

export interface PasswordResetInfo {
  available: boolean
  botUsername: string | null
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

/** O'qituvchi tarixi: o'chirish faqat hamma hisob 0 bo'lganda mumkin */
export interface TeacherUsage {
  deletable: boolean
  counts: {
    scores: number
    subjectGrades: number
    attendance: number
    timetableEntries: number
    lessonOverrides: number
    auditActions: number
  }
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

// ---- Dashboard vidjetlari ----
export interface UnscoredClassItem {
  classId: string
  className: string
  homeroomTeacher: { id: string; fullName: string } | null
  graded: number
  total: number
}

export interface UnscoredClasses {
  date: string
  scope: 'school' | 'homeroom'
  workingDay: boolean
  totalClasses: number
  classes: UnscoredClassItem[]
}

export type AttentionReason =
  | { type: 'drop'; from: number; to: number; delta: number }
  | { type: 'negative'; count: number }
  | { type: 'unexcused'; days: number }

export interface AttentionStudent {
  studentId: string
  fullName: string
  classId: string
  className: string
  reasons: AttentionReason[]
}

export interface AttentionStudents {
  current: { from: string; to: string }
  previous: { from: string; to: string }
  total: number
  students: AttentionStudent[]
}

export interface AttendanceTrendDay {
  date: string
  rate: number
  present: number
  late: number
  partial: number
  absentExcused: number
  absentUnexcused: number
  total: number
}

export interface AttendanceTrend {
  from: string
  to: string
  average: number | null
  days: AttendanceTrendDay[]
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
  /** Baholash varag'ida avtomatik to'ldiriladigan ball (null = yo'q) */
  defaultScore: number | null
  /** Reytingdan ayiriladigan jarima (kun+tur uchun bir marta; sozlamada yoqilgan bo'lsa). 0 = yo'q */
  ratingPenalty: number
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
  defaultScore?: number | null
  ratingPenalty?: number
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
  /** Dars raqami (jadval); 0 - darsga bog'lanmagan */
  lessonNo: number
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

/** Fanning shu kundagi darsi (baholash varag'ida) */
export interface GradeSheetLesson {
  lessonNo: number
  teacher: { id: string; fullName: string }
  cancelled: boolean
  room: string | null
  mine: boolean
}

export interface GradeSheet {
  class: { id: string; name: string }
  subject: { id: string; name: string }
  date: string
  /** null - fanning bir nechta darsi bor, tanlanishi kerak; 0 - darsga bog'lanmagan */
  lessonNo: number | null
  hasTimetable: boolean
  lessons: GradeSheetLesson[]
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
  lessonNo?: number
  /** Admin uchun: fanning bir nechta o'qituvchisi bo'lsa qaysi o'qituvchi darslari doirasida */
  teacherId?: string
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
  /** Xulq turi tanlanganda turning standart balli varaqda avtomatik qo'yiladi */
  autoFillScoreFromBehaviorType: boolean
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
  /** null = faqat jarima qaydi (ball yo'q; reytingdan behaviorPenalty ayiriladi) */
  value: number | null
  /** Baho paytidagi xulq turi jarimasi (snapshot); eski serverda yo'q = 0 */
  behaviorPenalty?: number
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
  value: number | null
  behaviorTypeId?: string | null
  comment?: string | null
}

export interface ScoreUpdatePayload {
  /** null = faqat jarima qaydiga o'tkazish */
  value?: number | null
  behaviorTypeId?: string | null
  comment?: string | null
}

export interface BulkScoreItem {
  studentId: string
  /** null = faqat jarima qaydi */
  value: number | null
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
  /** Davr yakuniy natijasini e'lon qilish (standart: o'chiq) */
  resultsEnabled: boolean
  /** Faqat haftalik davr uchun: ISO 1=Du..7=Ya */
  resultsWeekday: number
  /** "HH:mm" */
  resultsTime: string
  /** Oylik davr: 1–31, 0 = oyning oxirgi kuni */
  resultsMonthDay: number
  /** Chorak / o'quv yili / erkin davr: e'lon sanasi (YYYY-MM-DD); null yoki davrdan tashqarida = oxirgi kun */
  resultsDate: string | null
  /** Xulq turi jarimasini reytingga qo'llash (standart: o'chiq) */
  behaviorPenaltyEnabled: boolean
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
  /** Xulq turi jarimasi (sozlama yoqilgan bo'lsa) */
  behaviorPenalty?: number
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

/** E'lon qilingan (muzlatilgan) davr natijasi: ro'yxat elementi */
export interface RatingResultMeta {
  id: string
  periodType: RatingPeriodType
  periodKey: string
  label: string
  from: string
  /** Muzlatilgan oraliq oxiri (e'lon kuni) */
  to: string
  periodTo: string
  announcedAt: string
  manual: boolean
  studentsCount: number
  classesCount: number
}

export interface RatingResultStudent {
  studentId: string
  fullName: string
  classId: string
  className: string | null
  grade: number | null
  score: number
  rank: number
  daysCount: number
  scoresCount: number
}

export interface RatingResultClass {
  classId: string
  name: string
  grade: number
  score: number
  rank: number
  ratedStudents: number
}

export interface RatingResultDetail extends RatingResultMeta {
  settings: {
    method: string
    weights: RatingWeights
    minScoresCount: number
    tieBreak: TieBreakKey[]
  }
  students: RatingResultStudent[]
  classes: RatingResultClass[]
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

export type TimetableEnforcement = 'off' | 'suggest' | 'strict'

/** Davomatga jadvalning ta'siri (`timetable` sozlamasi) */
export interface TimetableAttendanceSettings {
  enforcement: TimetableEnforcement
  homeroomCanTakeAnyLesson: boolean
  strictNoTimetable: 'manual' | 'block'
}

export type AttendanceSource = 'timetable' | 'override' | 'manual'

export interface AttendanceRecord {
  id: string
  studentId: string
  student: PersonRef
  classId: string
  class: { id: string; name: string }
  date: string
  lessonNo: number
  /** Dars rejimida darsning fani (kunlik rejim va eski yozuvlarda null) */
  subjectId?: string | null
  subject?: { id: string; name: string } | null
  /** Snapshot: dars o'qituvchisi va manba (jadval / almashtirish / qo'lda) */
  teacherId?: string | null
  teacher?: { id: string; fullName: string } | null
  source?: AttendanceSource | null
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
  /** Shu soatda boshqa o'qituvchining (parallel) darsida belgilangan bo'lsa: kim va qaysi fan */
  otherLesson?: {
    teacher: { id: string; fullName: string } | null
    subject: { id: string; name: string } | null
  } | null
}

export interface AttendanceSheetSummary {
  total: number
  marked: number
  present: number
  late: number
  absentExcused: number
  absentUnexcused: number
}

export interface AttendanceSubjectOption {
  id: string
  name: string
  assigned: boolean
}

/** Sinfning shu sanadagi jadvaldan aniqlangan darsi (sheet.lessons) */
export interface AttendanceSheetLesson {
  classId: string
  date: string
  lessonNo: number
  groupKey: string | null
  subjectId: string
  teacherId: string
  room: string | null
  source: 'timetable' | 'override'
  overrideType?: string
  cancelled: boolean
  subject: { id: string; name: string } | null
  teacher: { id: string; fullName: string } | null
  /** Joriy foydalanuvchining darsi */
  mine: boolean
}

export interface AttendanceSheet {
  class: { id: string; name: string }
  date: string
  mode: AttendanceMode
  lessonNo: number | null
  /** Darsning saqlangan fani (bo'lsa) */
  subjectId?: string | null
  subject?: { id: string; name: string } | null
  /** Dars rejimida tanlanadigan fanlar (rolga qarab) */
  subjects?: AttendanceSubjectOption[]
  lessonsPerDay: number
  /** Dars rejimida ruxsat etilgan eng katta dars raqami: max(lessonsPerDay, jadvaldagi eng katta dars) */
  maxLessonNo?: number | null
  timetable?: {
    enforcement: TimetableEnforcement
    hasTimetable: boolean
    homeroomCanTakeAnyLesson: boolean
  }
  /** So'ralgan dars raqami uchun jadvaldagi dars (yo'q bo'lsa null) */
  lesson?: AttendanceSheetLesson | null
  lessons?: AttendanceSheetLesson[]
  /** Slotda bir nechta dars bor va qaysi biri ekani aniqlanmadi (admin / sinf rahbari tanlaydi) */
  lessonChoiceRequired?: boolean
  /** Joriy foydalanuvchi shu darsga davomat ola oladimi */
  canTake?: boolean
  cannotTakeReason?: string | null
  /** Jadvaldagi fan o'rniga boshqasini tanlash mumkin (admin / sinf rahbari, suggest) */
  canOverrideSubject?: boolean
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
  /** Dars rejimida: jadvaldan aniqlangan darsda ixtiyoriy (server o'zi aniqlaydi), aks holda majburiy */
  subjectId?: string
  /** Slotda bir nechta dars bo'lsa: qaysi o'qituvchining darsi (admin / sinf rahbari uchun) */
  teacherId?: string
  items: AttendanceBulkItem[]
}

export interface AttendanceUpdatePayload {
  statusId?: string
  subjectId?: string
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
  subjectId?: string
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

/** Kunning yakuniy holati: 'partial' = bir qism dars yo'q, bir qismi bor */
export type AttendanceDayStatus = AttendanceCategory | 'partial'

export interface AttendanceDay {
  date: string
  /** Eng og'ir kategoriya (orqaga moslik) */
  category: AttendanceCategory
  /** Kunning yakuniy holati; berilmasa `category` ishlatiladi */
  status?: AttendanceDayStatus
  lessons: number
  records: {
    lessonNo: number
    subjectId?: string | null
    subject?: { id: string; name: string } | null
    statusId: string
    category: AttendanceCategory
  }[]
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
  /** Bir qism dars yo'q, bir qismi bor (eski serverda bo'lmasligi mumkin) */
  partial?: number
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
  behaviorPenalty: number
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
    behaviorPenaltyTotal: number
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
    behaviorPenalty: number
    ratedStudentsInClass: number
  }
  trend: TrendPoint[]
  behaviorDistribution: ReportBehaviorShare[]
  attendance: Omit<ReportAttendanceCounts, 'rate'> & {
    rate: number | null
    penalty: number
    days: { date: string; category: AttendanceCategory; status?: AttendanceDayStatus }[]
  }
  entries: {
    date: string
    /** null = faqat jarima qaydi */
    value: number | null
    behaviorPenalty?: number
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
    behaviorPenaltyTotal: number
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

export type TodayAttendanceStatus = 'taken' | 'partial' | 'none'

/** GET /timetable/me/today: o'qituvchining bugungi darsi */
export interface TodayLesson {
  date: string
  lessonNo: number
  classId: string
  class: { id: string; name: string }
  subjectId: string
  subject: { id: string; name: string }
  /** Dars o'qituvchisi (bir soatda bir nechta dars bo'lishi mumkin) */
  teacherId?: string
  room: string | null
  source: 'timetable' | 'override'
  overrideType: 'substitute' | 'replace' | 'cancel' | 'extra' | null
  substitute: boolean
  cancelled: boolean
  status: TodayAttendanceStatus
  markedStudents: number
  totalStudents: number
}

export interface MyTodayLessons {
  date: string
  attendanceMode: AttendanceMode
  working: boolean
  /** O'qituvchiga bugun amal qiladigan jadval versiyasi bormi */
  hasTimetable: boolean
  lessons: TodayLesson[]
}

// ---- Telegram bot ----
export interface TelegramConfig {
  configured: boolean
  source: 'db' | 'env' | null
  enabled: boolean
  tokenLast4: string | null
  botUsername: string | null
  botName: string | null
  status: 'running' | 'stopped' | 'error'
  lastError: string | null
  updatedAt: string | null
}

export interface TelegramNotifyToggles {
  morningSchedule: boolean
  substitutions: boolean
  timetableChanges: boolean
  dailyReport: boolean
  weeklyReport: boolean
  ratingResults: boolean
  examResults: boolean
  examReminders: boolean
}

/** Maktabning bot xabarlari sozlamalari (null = avtomatik) */
export interface TelegramMessageSettings {
  /** ISO 1..7; null = davomat sozlamalaridagi ish haftasi */
  workdays: number[] | null
  morningTime: string
  dailyReportTime: string
  /** ISO 1..7; null = oxirgi ish kuni */
  weeklyReportDay: number | null
  weeklyReportTime: string
  notify: TelegramNotifyToggles
  dailyReportAbsentNames: boolean
}

export interface TelegramMe {
  available: boolean
  botUsername: string | null
  linked: boolean
  username: string | null
  linkedAt: string | null
}

export interface TelegramLinkInfo {
  url: string
  expiresAt: string
}

// ---- Imtihonlar (savollar banki) ----
export interface ExamsSettings {
  enabled: boolean
  teachersCanCreateQuizzes: boolean
  teacherQuizNeedsApproval: boolean
  candidateRetentionDays: number
}

export type QuestionType = 'single' | 'multi' | 'short' | 'essay'
export type QuestionStatus = 'draft' | 'active' | 'archived'
export type QuestionDifficulty = 1 | 2 | 3

/** Kontent bloki: HTML yo'q, faqat matn / formula (TeX) / rasm (assetId) */
export type QuestionBlock =
  | { type: 'text'; text: string }
  | { type: 'math'; tex: string }
  | { type: 'image'; assetId: string }

export interface QuestionOption {
  id: string
  content: QuestionBlock[]
}

/** Javob kaliti: faqat tahrirlash huquqi bor foydalanuvchiga keladi */
export interface QuestionAnswer {
  optionId?: string | null
  optionIds?: string[]
  partialCredit?: boolean
  acceptedAnswers?: string[]
  rubric?: string
}

export interface QuestionListItem {
  id: string
  subjectId: string
  subjectName: string | null
  topicId: string
  topicName: string | null
  difficulty: QuestionDifficulty
  type: QuestionType
  points: number
  status: QuestionStatus
  version: number
  authorId: string
  authorName: string | null
  isMine: boolean
  canEdit: boolean
  /** Ulashilgan (private emas) */
  isShared: boolean
  /** Boshqa muallifning savoli menga ulashilgan */
  sharedWithMe: boolean
  preview: string
  hasMath: boolean
  hasImage: boolean
  optionsCount: number
  createdAt: string
  updatedAt: string
}

export interface Question extends Omit<
  QuestionListItem,
  'preview' | 'hasMath' | 'hasImage' | 'optionsCount'
> {
  content: QuestionBlock[]
  options: QuestionOption[]
  /** Ko'ra oladigan har kim oladi (ulashish muallif ruxsati bilan) */
  answer?: QuestionAnswer
  /** Faqat tahrir huquqi borlarga */
  sharing?: QuestionSharing
}

export type SharingMode = 'private' | 'subject' | 'users'
export interface QuestionSharing {
  mode: SharingMode
  userIds: string[]
}

export interface ShareTeacher {
  id: string
  fullName: string
  teachesSubject: boolean
}

export interface QuestionPayload {
  /** Mavzu majburiy; fan mavzudan olinadi */
  topicId: string
  difficulty: QuestionDifficulty
  type: QuestionType
  content: QuestionBlock[]
  options: QuestionOption[]
  answer: QuestionAnswer
  points: number
  status: 'draft' | 'active'
  sharing: QuestionSharing
}

export interface QuestionListParams extends PageParams {
  subjectId?: string
  topicId?: string
  difficulty?: number
  type?: QuestionType
  status?: QuestionStatus
  mine?: boolean
  shared?: boolean
  search?: string
}

export interface ExamSubjectCard {
  id: string
  name: string
  isActive: boolean
  topicsCount: number
  /** Foydalanuvchiga ko'rinadigan savollar soni */
  questionsCount: number
}

export interface ExamSubjectsResponse {
  scope: 'all' | 'own'
  subjects: ExamSubjectCard[]
}

export interface ExamTopic {
  id: string
  subjectId: string
  subjectName: string | null
  name: string
  description: string
  order: number
  createdBy: string
  createdByName: string | null
  isMine: boolean
  questionsCount: number
  isEmpty: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface ExamTopicsResponse {
  subject: { id: string; name: string; isActive: boolean }
  topics: ExamTopic[]
}

export interface ExamAssetInfo {
  id: string
  contentType: string
  size: number
  width: number
  height: number
}

// ---- Savollar importi (Excel / Word) ----
export interface ExamImportItem {
  row: number
  subjectName: string | null
  subjectId: string | null
  difficulty: number
  type: QuestionType | null
  points: number
  content: QuestionBlock[]
  options: QuestionOption[]
  answer: QuestionAnswer
  errors: string[]
  warnings: string[]
}

export interface ExamImportPreview {
  id: string
  kind: 'excel' | 'word'
  fileName: string
  expiresAt: string
  consumed: boolean
  warnings: string[]
  stats: { total: number; valid: number; invalid: number }
  items: ExamImportItem[]
  /** Import nishoni */
  topic: { id: string; name: string; subjectName: string | null }
}

export interface ExamImportOverride {
  row: number
  type?: QuestionType
  difficulty?: number
  points?: number
  answer?: QuestionAnswer
}

export interface ExamImportResult {
  created: number
  failed: { row: number; errors: string[] }[]
  excluded: number
  total: number
  replay?: boolean
}

// ---- Imtihonlar (shablon, sessiya, nomzod) ----
export type ExamSessionType = 'quiz' | 'quarter' | 'annual' | 'trial' | 'admission'
export type ExamSessionStatus =
  'draft' | 'pending_approval' | 'scheduled' | 'open' | 'closed' | 'cancelled'
export type ExamResultsMode = 'score' | 'score_answers' | 'after_publish' | 'never'
export type ExamParticipantKind = 'student' | 'guest' | 'candidate'

export type ExamSectionItem =
  | { kind: 'manual'; questionIds: string[] }
  | {
      kind: 'rule'
      /** Eski shakl (bitta mavzu); yangi qoidalarda topicIds yoki allTopics */
      topicId?: string
      topicIds?: string[]
      allTopics?: boolean
      count: number
      difficulty?: number | null
      type?: QuestionType | null
    }
export interface ExamSection {
  title: string
  items: ExamSectionItem[]
}
export interface ExamItemInfo {
  kind: 'manual' | 'rule'
  available: number
  requested: number
  ok: boolean
  topicName?: string | null
  /** Qoida: mavzu id (faollashtirish havolasi uchun) */
  topicId?: string
  /** Mos keladigan, lekin QORALAMA holatidagi savollar soni */
  draft?: number
}
export interface ExamSectionsPreview {
  sections: { title: string; items: ExamItemInfo[] }[]
  /** Blok rejimida: har blok (elementlar holati, savollar soni, maqsad) */
  blocks?: { title: string; items: ExamItemInfo[]; count: number; target: number; ok: boolean }[]
  errors: string[]
  poolSize: number
  questionsPerParticipant: number
  ok: boolean
}

// ---- Blokli (bir nechta fanli) imtihon ----
export type ExamScoringMode = 'points' | 'coefficient'
export type ExamTimingMode = 'common' | 'per_block'
/** Tuzuvchi kiritadigan blok */
export interface ExamBlockInput {
  /** Mavjud blokni tahrirlashda (o'qituvchilar savollari saqlanadi) */
  blockId?: string
  subjectId: string
  title?: string
  targetCount: number
  coefficient: number
  durationMin?: number | null
  contributorIds: string[]
  items: ExamSectionItem[]
}
export type ExamBlockContent = 'bank' | 'file'
/** Fayl + kalit blokining qisqa xulosasi (kalitsiz) */
export interface FileTestSummary {
  questions: number
  delivery?: FileDelivery
  variants: {
    letter: string
    kind: 'pdf' | 'image'
    files: number
    questions: number
    points: number
  }[]
}
/** Serverdagi blok (tuzuvchi ko'rinishi) */
export interface ExamBlock {
  id: string
  legacy: boolean
  subjectId: string | null
  subjectName: string | null
  title: string
  targetCount: number
  coefficient: number
  durationMin: number | null
  status: 'open' | 'ready'
  readyBy?: 'contributor' | 'composer' | null
  /** Oxirgi "Eslatma" vaqti (soatiga bir marta cheklanadi) */
  remindedAt?: string | null
  count: number
  /** Blok mazmuni (eski serverda yo'q = 'bank') */
  content?: ExamBlockContent
  fileTest?: FileTestSummary | null
  contributors: { id: string; fullName: string }[]
  items: ExamSectionItem[]
  contribQuestions: {
    questionId: string
    addedBy: string
    addedByName: string | null
    addedAt: string | null
  }[]
  /** Tasodifiy tanlash qoidalari (har o'quvchiga boshqacha) */
  contribRules?: {
    ruleId: string
    topicIds: string[]
    allTopics: boolean
    difficulty: number | null
    type: QuestionType | null
    count: number
    addedBy: string
    addedByName: string | null
    addedAt: string | null
  }[]
}
export interface ExamTemplateBlock {
  blockId: string
  subjectId: string
  title: string
  targetCount: number
  coefficient: number
  durationMin: number | null
  contributorIds: string[]
  items: ExamSectionItem[]
}
export interface ExamTemplate {
  id: string
  title: string
  subjectId: string | null
  sections: ExamSection[]
  blocks?: ExamTemplateBlock[]
  scoringMode?: ExamScoringMode
  timingMode?: ExamTimingMode
  shuffleQuestions: boolean
  shuffleOptions: boolean
  createdAt: string
}
export interface ExamSessionParticipant {
  key: string
  kind: ExamParticipantKind
  fullName: string
  className: string | null
  grade: number | null
  origin: string | null
  hasPin: boolean
  /** Shaxsiy kirish kodi bor (kodning o'zi ro'yxatda chiqmaydi) */
  hasCode?: boolean
  fullTimeGranted: boolean
  extraMinutes: number
}
/** Profil sahifasidagi imtihon natijasi (o'quvchi va nomzod uchun bir xil, barqaror DTO) */
export interface ProfileExamResult {
  sessionId: string
  title: string
  heldAt: string
  closedAt: string | null
  subjects: string[]
  scoringMode: string
  passPercent: number | null
  earned: number
  max: number
  percent: number
  passed: boolean | null
  essayPending: number
  blocks: {
    id: string
    title: string
    subjectName: string | null
    coefficient: number
    earned: number
    max: number
    percent: number
  }[]
  examDeleted: boolean
  /** Nazoratchi to'xtatgan: sabab */
  terminated?: { reason: string } | null
}
export interface ProfileExamResults {
  items: ProfileExamResult[]
  summary: { count: number; averagePercent: number | null; passedCount: number }
}
export interface ExamResultListItem {
  id: string
  title: string
  heldAt: string
  endsAt: string
  closedAt: string | null
  subjects: { id: string; name: string }[]
  classes: { id: string; name: string }[]
  blocksCount: number
  scoringMode: ExamScoringMode
  participants: number
  submitted: number
  /** Imtihonning o'zi o'chirilgan, natijalari saqlangan */
  examDeleted: boolean
}
export type ExamDeleteMode = 'exam_only' | 'with_results'
export interface ExamCopyResult {
  session: ExamSession
  warnings: string[]
}
export interface ExamSessionItem {
  id: string
  canCopy?: boolean
  canReturnToDraft?: boolean
  scoringMode?: ExamScoringMode
  timingMode?: ExamTimingMode
  contribDeadline?: string | null
  blocksCount?: number
  /** Fanlar jamlamasi: jami, o'qituvchi tugatgan va tasdiqlangan (o'qituvchisiz fan tasdiqlangan) */
  blocksProgress?: { total: number; done: number; approved: number }
  title: string
  type: ExamSessionType
  status: ExamSessionStatus
  phase: 'upcoming' | 'running' | 'ended' | null
  subjectId: string | null
  subjectName: string | null
  classes: { id: string; name: string }[]
  scheduledStart: string
  durationMin: number
  endsAt: string
  code: string | null
  resultsMode: ExamResultsMode
  shuffleQuestions: boolean
  shuffleOptions: boolean
  participantsCount: number
  supervisors: { id: string; fullName: string }[]
  approval: {
    status: 'none' | 'pending' | 'approved' | 'rejected'
    reason: string
    at: string | null
  }
  pool: { frozen: boolean; frozenAt: string | null }
  createdBy: string
  createdByName: string | null
  isMine: boolean
  cancelReason: string
  createdAt: string
  canEdit: boolean
  canSubmit: boolean
  canApprove: boolean
  canManageParticipants: boolean
  canGrant: boolean
  canOpen: boolean
  canClose: boolean
  canCancel: boolean
  canPrint: boolean
  canDelete: boolean
  canReopen: boolean
  canExtend: boolean
  /** Jonli kuzatuv (E5): ko'rish va (faqat ochiq imtihonda) ogohlantirish/to'xtatish */
  canMonitor: boolean
  canIntervene: boolean
  canViewResults: boolean
  timeUp: boolean
  passPercent: number | null
  resultsPublished: boolean
}
export interface ExamSession extends ExamSessionItem {
  templateId: string | null
  sections: ExamSection[]
  /** Urinish bor: qoralamaga qaytarib bo'lmaydi, o'chirishda tanlov kerak */
  hasAttempts?: boolean
  blocks?: ExamBlock[]
  participants: ExamSessionParticipant[]
}
export interface ExamSessionBody {
  title: string
  type: ExamSessionType
  subjectId?: string | null
  classIds: string[]
  templateId?: string | null
  sections?: ExamSection[]
  blocks?: ExamBlockInput[]
  scoringMode?: ExamScoringMode
  timingMode?: ExamTimingMode
  contribDeadline?: string | null
  scheduledStart: string
  durationMin?: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  resultsMode: ExamResultsMode
  supervisorIds: string[]
  passPercent?: number | null
}
export interface ExamSessionMeta {
  pinSecretConfigured: boolean
  isAdministration: boolean
  teachersCanCreateQuizzes: boolean
  teacherQuizNeedsApproval: boolean
  allowedTypes: ExamSessionType[]
  supervisors: { id: string; fullName: string; role: string }[]
  /** Blokka biriktirish uchun (faqat ma'muriyat): subjectIds null = istalgan fan (maktab admini) */
  contributors?: { id: string; fullName: string; role: string; subjectIds: string[] | null }[]
}

// ---- Biriktirilgan o'qituvchi: blok ----
export type BlockLockReason = 'status' | 'ready' | 'deadline' | null
/** "Matnni joylash": serverdagi tahlil natijasi (yagona haqiqat manbai) */
export type PasteWarnCode =
  | 'noText'
  | 'noAnswer'
  | 'fewOptions'
  | 'dupLetters'
  | 'badAnswer'
  | 'conflict'
  | 'tooLong'
  | 'unparsed'
  | 'badMath'
export interface PasteWarning {
  code: PasteWarnCode
  message: string
  /** Hal qilinmasa savol saqlanmaydi */
  blocking: boolean
}
export interface PasteQuestion {
  idx: number
  number: number | null
  line: number
  content: QuestionBlock[]
  options: { id: string; content: QuestionBlock[] }[]
  correct: string[]
  type: 'single' | 'multi'
  warnings: PasteWarning[]
  /** Javobni qo'lda tanlash mumkin (javob yo'q/noaniq) */
  pickable: boolean
}
export interface PastePreview {
  stats: { total: number; ok: number; problems: number }
  items: PasteQuestion[]
  ignored: { line: number; text: string }[]
  limits: { maxQuestions: number; maxBytes: number }
}
export interface PasteCommitBody {
  text: string
  topicId?: string
  difficulty: number
  points: number
  picks: { idx: number; answer: string[] }[]
  exclude: number[]
  status?: 'draft' | 'active'
}
export interface PasteCommitResult {
  created: number
  ids: string[]
  skipped: { idx: number; reasons: string[] }[]
  failed: { idx: number; errors: string[] }[]
  excluded: number
  total: number
  /** Faqat vazifada */
  addedToBlock?: number
  count?: number
  target?: number
}

export interface MyBlockItem {
  sessionId: string
  blockId: string
  examTitle: string
  examStatus: ExamSessionStatus
  subjectId: string | null
  subjectName: string | null
  title: string
  targetCount: number
  count: number
  blockStatus: 'open' | 'ready'
  content?: ExamBlockContent
  readyBy?: 'contributor' | 'composer' | null
  contribDeadline: string | null
  locked: boolean
  lockReason: BlockLockReason
}
export interface BlockQuestionRow {
  id: string
  missing: boolean
  type: QuestionType | null
  difficulty: number | null
  points: number | null
  status: string | null
  preview: string
  hasMath: boolean
  hasImage: boolean
  authorName: string | null
  source: 'composer' | 'contributor'
  addedByName: string | null
  canRemove: boolean
}
export interface BlockRuleRow {
  /** null: tuzuvchi bloki elementi (wizarddagi qoida); aks holda tasodifiy tanlash qoidasi id si */
  ruleId?: string | null
  topicId: string
  topicIds?: string[]
  allTopics?: boolean
  /** "Algebra, Geometriya" (allTopics bo'lsa null: "barcha mavzular") */
  topicName: string | null
  count: number
  difficulty: number | null
  type: QuestionType | null
  addedByName?: string | null
  canRemove?: boolean
  /** Hozir mos keladigan FAOL savollar soni (har o'quvchi shundan tanlaydi) */
  poolSize?: number
}

// ---- Daraja bo'yicha tasodifiy tanlash (E8) ----
export interface RandomSel {
  topicIds?: string[]
  allTopics?: boolean
  type?: QuestionType | null
}
export interface RandomAvailability {
  difficulties: Record<'1' | '2' | '3', { total: number; inExam: number; available: number }>
  topics: string[]
}
export interface RandomQuestion {
  id: string
  difficulty: number
  type: QuestionType
  points: number
  content: QuestionBlock[]
  options: { id: string; content: QuestionBlock[]; correct: boolean }[]
  acceptedAnswers?: string[]
  rubric?: string
}
export interface RandomPreview {
  items: RandomQuestion[]
  available: Record<'1' | '2' | '3', number>
  shortfall: Record<'1' | '2' | '3', number>
}
export interface MyBlockDetail {
  /** 'composer': ma'muriyat (istalgan fan, hamma savolni olib tashlaydi); 'contributor': biriktirilgan o'qituvchi */
  role?: 'composer' | 'contributor'
  exam: { id: string; title: string; contribDeadline: string | null }
  block: {
    readyBy?: 'contributor' | 'composer' | null
    canMarkReady?: boolean
    id: string
    subjectId: string | null
    subjectName: string | null
    title: string
    targetCount: number
    count: number
    status: 'open' | 'ready'
    /** 'file': savollar banki o'rniga fayl testi (PDF/rasm) va javob kaliti tahrirlanadi */
    content?: ExamBlockContent
    fileTest?: FileTestSummary | null
    /** Almashtirish tasdig'i uchun: ikkala usulda mazmun bormi */
    hasBank?: boolean
    hasFile?: boolean
    locked: boolean
    lockReason: BlockLockReason
  }
  questions: BlockQuestionRow[]
  rules: BlockRuleRow[]
}

// ---- Fayl + kalit (§22) ----
export interface FileKeyItem {
  no: number
  type: 'choice' | 'short'
  /** choice: variantlar soni (2..6) */
  options?: number
  /** choice: to'g'ri harflar (bittasi yoki bir nechta) */
  correct?: string[]
  /** short: qabul qilinadigan javoblar */
  accepted?: string[]
  points: number
}
/** Yetkazish: 'screen' - fayl serverda vaqtincha turadi (ekranda); 'paper' - fayl yuklanmaydi, qog'ozda tarqatiladi */
export type FileDelivery = 'screen' | 'paper'
export interface FileTestFileInfo {
  id: string
  /** 'expired': baytlar o'chirilgan (imtihon yopilgandan 14 kun keyin), kalit saqlangan */
  state?: 'pending' | 'ready' | 'expired'
  kind: 'pdf' | 'image'
  contentType: string
  size: number
  width: number
  height: number
  pages: number
}
export interface FileTestVariant {
  letter: 'A' | 'B' | 'C' | 'D'
  kind: 'pdf' | 'image'
  files: FileTestFileInfo[]
  key: FileKeyItem[]
}
export interface FileTestView {
  role: 'composer' | 'contributor'
  content: ExamBlockContent
  delivery: FileDelivery
  /** Almashtirish tasdig'i uchun: ikkala usulda mazmun bormi */
  hasBank: boolean
  hasFile: boolean
  locked: boolean
  lockReason: BlockLockReason
  status: 'open' | 'ready'
  readyBy?: 'contributor' | 'composer' | null
  variants: FileTestVariant[]
  questions: number
}
export interface FileTestSaveBody {
  delivery: FileDelivery
  variants: {
    letter: FileTestVariant['letter']
    kind: 'pdf' | 'image'
    files: string[]
    key: FileKeyItem[]
  }[]
}
export interface FileKeyParse {
  items: FileKeyItem[]
  errors: string[]
  warnings: string[]
}
export interface RemindResult {
  disabled: boolean
  notConnected: boolean
  sent: number
  blocks: { blockId: string; subjectName: string; state: 'sent' | 'recent' }[]
}
export interface BlockQuestionList {
  questions: BlockQuestionRow[]
  rules: BlockRuleRow[]
}
export interface BlockCounts {
  count: number
  target: number
}
export interface ExamClassOption {
  id: string
  name: string
  grade: number
  studentsCount: number
}
export interface ExamParticipantsBody {
  classIds?: string[]
  studentIds?: string[]
  guests?: { fullName: string; origin: string }[]
  candidateIds?: string[]
}
export interface ExamCandidate {
  id: string
  fullName: string
  targetGrade: number | null
  birthDate: string | null
  hasBirthDate: boolean
  parentPhone: string | null
  notes: string
  piiPurged: boolean
  createdAt: string
}
export interface ExamCandidateBody {
  fullName: string
  birthDate?: string | null
  targetGrade?: number | null
  parentPhone?: string | null
  notes?: string
}

export interface BulkStatusResult {
  updated: number
  unchanged: number
  skipped: { id: string; reason: string }[]
}

export type ExamAttemptStatus =
  'not_started' | 'joined' | 'in_progress' | 'submitted' | 'auto_submitted'
export interface ExamAttemptRow {
  key: string
  status: ExamAttemptStatus
  answered: number
  total: number
  startedAt: string | null
  submittedAt: string | null
  deadline: string | null
  lastSeenAt: string | null
  warnings: number
  reconnects: number
  allowReentry: boolean
  blockIndex?: number
  /** Nazoratchi to'xtatgan (E5) */
  terminated?: { reason: string } | null
}

/** Nazoratchi jonli ekrani (E5): bitta ishtirokchi qatori */
export interface ExamLiveRow {
  key: string
  kind: ExamParticipantKind
  fullName: string
  className: string | null
  status: ExamAttemptStatus
  answered: number
  total: number
  /** per_block: joriy blok */
  block: { id: string; title: string; index: number; total: number; deadline: string | null } | null
  startedAt: string | null
  submittedAt: string | null
  deadline: string | null
  lastSeenAt: string | null
  /** Oynadan chiqishlar (blur + to'liq ekrandan chiqish + yashirilgan oyna) */
  leaves: number
  leaveDetail: { blur: number; fullscreen: number; hidden: number }
  lastLeaveAt: string | null
  reconnects: number
  warningsSent: number
  warningsPending: number
  lastWarnAt: string | null
  terminated: { at: string; byName: string; reason: string } | null
  fullTimeGranted: boolean
  extraMinutes: number
  allowReentry: boolean
}
/** Jonli ekran javobining ixcham (tarmoq) shakli: ishtirokchilar ro'yxati faqat o'zgarganda, qatorlarda standart qiymatlar yo'q */
export interface ExamLiveRosterEntry {
  key: string
  kind: ExamParticipantKind
  fullName: string
  className: string | null
  fullTimeGranted?: boolean
  extraMinutes?: number
  allowReentry?: boolean
}
export type ExamLiveRawRow = Partial<Omit<ExamLiveRow, 'key' | 'status'>> & {
  key: string
  status: ExamAttemptStatus
}
export interface ExamLiveRaw extends Omit<ExamLiveResponse, 'items'> {
  rosterKey: string
  roster?: ExamLiveRosterEntry[]
  rows: ExamLiveRawRow[]
}
export interface ExamLiveResponse {
  serverNow: string
  session: {
    id: string
    title: string
    status: ExamSessionStatus
    timingMode: 'common' | 'per_block'
    scheduledStart: string
    endsAt: string
  }
  canIntervene: boolean
  staleAfterSec: number
  counts: {
    total: number
    notStarted: number
    joined: number
    inProgress: number
    submitted: number
    terminated: number
    warned: number
    withLeaves: number
  }
  items: ExamLiveRow[]
  joinAlert: { failures: number; lastAt: string | null; alertAt: string | null }
}
export interface ExamAttemptsResponse {
  items: ExamAttemptRow[]
  joinAlert: { failures: number; lastAt: string | null; alertAt: string | null }
}

// ---- Natijalar (E6) ----
export interface ExamResultRow {
  key: string
  kind: ExamParticipantKind
  fullName: string
  className: string | null
  status: ExamAttemptStatus
  earned: number | null
  max: number | null
  percent: number | null
  passed: boolean | null
  answered: number
  total: number
  timeSpentSec: number | null
  warnings: number
  /** Nazoratchi to'xtatgan: sabab (natija shu paytgacha javoblardan) */
  terminated?: { reason: string; at: string; byName: string } | null
  essayPending: number
  rank: number | null
  /** Blok bo'yicha ballar (topshirmagan: bo'sh) */
  blocks?: { blockId: string; earned: number; max: number }[]
  /** Fayl + kalit bloklarida berilgan variant ("A" yoki "A/C"); yo'q: null */
  variant?: string | null
}
export interface ExamResultBlockHeader {
  id: string
  legacy: boolean
  subjectId: string | null
  subjectName?: string | null
  title: string
  coefficient: number
  durationMin: number | null
}
export interface ExamResultSummary {
  participants: number
  started: number
  submitted: number
  averagePercent: number | null
  maxPercent: number | null
  minPercent: number | null
  passPercent: number | null
  passRate: number | null
  passedCount: number
  essayPending: number
}
export interface ExamResultsResponse {
  session: {
    id: string
    title: string
    status: ExamSessionStatus
    resultsMode: ExamResultsMode
    resultsPublished: boolean
    publishedAt: string | null
    passPercent: number | null
    scheduledStart: string
    endsAt: string
    scoringMode?: ExamScoringMode
    timingMode?: ExamTimingMode
    examDeleted?: boolean
  }
  blocks?: ExamResultBlockHeader[]
  summary: ExamResultSummary
  rows: ExamResultRow[]
}
export interface ExamResultQuestion {
  id: string
  blockId?: string | null
  index: number
  type: QuestionType
  points: number
  content: QuestionBlock[]
  options: { id: string; content: QuestionBlock[] }[]
  given: string | string[] | null
  flagged: boolean
  correct: { optionIds?: string[]; texts?: string[]; rubric?: string }
  got: number | null
  ok: boolean | null
  graded: boolean | null
  grade: { points: number; comment: string; by: string | null; at: string } | null
}
export interface ExamResultDetail {
  participant: {
    key: string
    fullName: string
    className: string | null
    kind?: ExamParticipantKind
  }
  status: ExamAttemptStatus
  terminated?: { reason: string; at: string; byName: string } | null
  startedAt?: string | null
  submittedAt?: string | null
  score: { earned: number; max: number; essayPending: number } | null
  blocks?: ExamResultBlockHeader[]
  blockScores?: {
    blockId: string
    earned: number
    max: number
    questions?: number
    correct?: number
  }[]
  percent?: number | null
  /** Fayl + kalit: berilgan variant harflari ("A") va blokma-blok {blockId: 'A'} */
  variant?: string | null
  variants?: Record<string, string>
  /** Fayl bloklari: qog'oz yetkazishda variantni tuzatish uchun */
  fileBlocks?: {
    blockId: string
    title: string
    delivery: FileDelivery
    letters: string[]
    variant: string | null
  }[]
  questions: ExamResultQuestion[]
}
export interface ExamAnalysisQuestion {
  id: string
  blockId?: string
  index: number
  type: QuestionType
  points: number
  content: QuestionBlock[]
  shown: number
  answered: number
  correctPercent: number | null
  averagePoints: number | null
  options: {
    id: string
    content: QuestionBlock[]
    chosen: number
    percent: number
    correct: boolean
  }[]
  flags: ('too_easy' | 'too_hard' | 'distractor')[]
}
export interface ExamAnalysis {
  submittedAttempts: number
  blocks?: ExamResultBlockHeader[]
  questions: ExamAnalysisQuestion[]
}
