import type { UpdateUserDataModel } from '@vemetric/queues/update-user-queue';

export const getUpdatedUserData = (existingUserData: object, newUserData: UpdateUserDataModel) => {
  const { set, setOnce, unset } = newUserData ?? {};
  const updatedUserData = { ...setOnce, ...existingUserData, ...set };

  if (unset) {
    unset.forEach((prop) => {
      delete (updatedUserData as any)[prop];
    });
  }

  return updatedUserData;
};
