export const getAPIErrorStatus = (error: unknown): number | undefined => {
  const err = error as any
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

export const getAPIErrorMessage = (error: unknown, fallback: string) => {
  const err = error as any
  return err?.data?.message ?? err?.message ?? fallback
}

export const isForbiddenError = (error: unknown) => getAPIErrorStatus(error) === 403

export const isNotFoundError = (error: unknown) => getAPIErrorStatus(error) === 404
