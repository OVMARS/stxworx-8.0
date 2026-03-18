type NotificationItem = {
  id: number;
  title: string;
  read: boolean;
};

let notifications: NotificationItem[] = [];

export const notificationStore = {
  getState: () => notifications,
  setNotifications: (nextNotifications: NotificationItem[]) => {
    notifications = nextNotifications;
    return notifications;
  },
};
