import type { Role } from "@/generated/prisma/client";

export type TelegramChat = {
  id: number | string;
  type: string;
  username?: string;
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type LinkedTelegramUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
};
