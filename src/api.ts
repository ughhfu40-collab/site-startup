/** Bounded requests with readable errors and a shared expired-session signal. */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
 const timeout = AbortSignal.timeout(15000);
 const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
 try {
  const response = await fetch(url, {...options, signal});
  if (response.status === 401 && !url.startsWith('/api/auth/login')) window.dispatchEvent(new Event('session-expired'));
  return response;
 } catch (error) {
  if (options.signal?.aborted) throw error;
  throw new Error(timeout.aborted ? 'Сервер долго отвечает. Попробуй ещё раз.' : 'Нет связи с сервером. Проверь интернет и повтори.');
 }
}
