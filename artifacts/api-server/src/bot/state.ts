export type BotState =
  | { step: "idle" }
  | { step: "awaiting_profile_name" }
  | { step: "awaiting_profile_photo"; name: string }
  | { step: "awaiting_rating"; profileId: number }
  | { step: "awaiting_comment"; profileId: number; rating: number }
  | { step: "awaiting_admin_id_add" }
  | { step: "awaiting_admin_id_remove" }
  | { step: "awaiting_profile_delete" };

const userStates = new Map<number, BotState>();

export function getState(userId: number): BotState {
  return userStates.get(userId) ?? { step: "idle" };
}

export function setState(userId: number, state: BotState) {
  userStates.set(userId, state);
}

export function clearState(userId: number) {
  userStates.set(userId, { step: "idle" });
}
