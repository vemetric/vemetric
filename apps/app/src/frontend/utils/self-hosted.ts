/**
 * True when the frontend was built for a self hosted instance.
 *
 * Self hosted instances must not talk to Vemetric's own infrastructure, so features that rely
 * on it (the support chat, the favicon service) are compiled out instead of failing at runtime.
 */
export const IS_SELF_HOSTED = import.meta.env.VITE_SELF_HOSTED === 'true';
