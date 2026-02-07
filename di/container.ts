import { AuthRepository } from "@/repositories/auth/AuthRepository";
import { QueueRepository } from "@/repositories/tabs/QueueRepository";
import { NotificationsRepository } from "@/repositories/tabs/NotificationsRepository";
import { HistoryRepository } from "@/repositories/tabs/HistoryRepository";
import { ChatRepository } from "@/repositories/tabs/ChatRepository";
import { DashboardRepository } from "@/repositories/tabs/DashboardRepository";


export const container = {
  authRepository: new AuthRepository(),
  queueRepository: new QueueRepository(),
  notificationsRepository: new NotificationsRepository(),
  historyRepository: new HistoryRepository(),
  chatRepository: new ChatRepository(),
  dashboardRepository: new DashboardRepository(),
};