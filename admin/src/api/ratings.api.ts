import { clean, getData, http } from './http'
import type {
  ApiSuccess,
  ApiMeta,
  ClassRatingItem,
  RatingConfig,
  RatingListResult,
  RatingResultDetail,
  RatingResultMeta,
  SchoolRatingItem,
  StudentRatingItem,
  StudentRatingParams,
} from './types'

const schoolHeader = (schoolId?: string) =>
  schoolId ? { headers: { 'X-School-Id': schoolId } } : {}

async function list<T>(
  url: string,
  params: object,
  schoolId?: string,
): Promise<RatingListResult<T>> {
  const res = await http.get<
    ApiSuccess<{ period: RatingListResult<T>['period']; calculatedAt: string | null; items: T[] }>
  >(url, { params: clean(params), ...schoolHeader(schoolId) })
  const { period, calculatedAt, items } = res.data.data
  const meta: ApiMeta = res.data.meta ?? {
    page: 1,
    limit: items.length,
    total: items.length,
    totalPages: 1,
  }
  return { period, calculatedAt, items, meta }
}

export const ratingsApi = {
  config: (schoolId?: string) =>
    http
      .get<ApiSuccess<RatingConfig>>('/ratings/config', schoolHeader(schoolId))
      .then((r) => r.data.data),
  students: (params: StudentRatingParams = {}, schoolId?: string) =>
    list<StudentRatingItem>('/ratings/students', params, schoolId),
  classes: (params: { grade?: number; from?: string; to?: string } = {}, schoolId?: string) =>
    list<ClassRatingItem>('/ratings/classes', params, schoolId),
  schools: () =>
    getData<{ items: SchoolRatingItem[] } | SchoolRatingItem[]>('/ratings/schools').then((d) =>
      Array.isArray(d) ? d : d.items,
    ),
  /** E'lon qilingan davr natijalari arxivi (yangisi birinchi) */
  async results(
    params: { page?: number; limit?: number } = {},
    schoolId?: string,
  ): Promise<{ items: RatingResultMeta[]; meta: ApiMeta }> {
    const res = await http.get<ApiSuccess<RatingResultMeta[]>>('/ratings/results', {
      params: clean(params),
      ...schoolHeader(schoolId),
    })
    const items = res.data.data
    const meta: ApiMeta = res.data.meta ?? {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
    }
    return { items, meta }
  },
  result: (id: string, schoolId?: string) =>
    http
      .get<ApiSuccess<RatingResultDetail>>(`/ratings/results/${id}`, schoolHeader(schoolId))
      .then((r) => r.data.data),
  /** Joriy davr natijasini hoziroq e'lon qilish (faqat superadmin) */
  announce: (schoolId?: string) =>
    http
      .post<ApiSuccess<RatingResultMeta>>(
        '/ratings/results/announce',
        undefined,
        schoolHeader(schoolId),
      )
      .then((r) => r.data.data),
  /** Arxivni yumshoq o'chirish (faqat superadmin) */
  deleteResult: (id: string, schoolId?: string) =>
    http
      .delete<ApiSuccess<{ id: string }>>(`/ratings/results/${id}`, schoolHeader(schoolId))
      .then((r) => r.data.data),
  async recalculate(schoolId?: string): Promise<{ recalculatedAt: string }> {
    const res = await http.post<ApiSuccess<{ recalculatedAt: string }>>(
      '/ratings/recalculate',
      undefined,
      schoolHeader(schoolId),
    )
    return res.data.data
  },
}
