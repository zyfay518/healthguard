export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('healthguard_device_id');
    if (!deviceId) {
        deviceId = crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('healthguard_device_id', deviceId);
    }
    return deviceId;
};
