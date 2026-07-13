import { api } from "./api";

export async function authenticateWithInvitation<TResult>(
  authenticate: () => Promise<TResult>,
  invitationToken: string
): Promise<TResult> {
  const result = await authenticate();

  if (invitationToken) {
    await api.acceptInvitation(invitationToken);
  }

  return result;
}
